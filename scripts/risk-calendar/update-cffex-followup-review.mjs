import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCffexMarketImpact } from './cffex-market-impact.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const positionPath = path.join(rootDir, 'data/cffex-position-watch.json');
const isDryRun = process.argv.includes('--dry-run');

function argValue(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];
  return '';
}

function beijingParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function nowChinaLabel() {
  const p = beijingParts();
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} 北京时间`;
}

function beijingToday() {
  const p = beijingParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function tradeDateOf(event) {
  return event?.cffexPositionAnalysis?.tradeDate || '';
}

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isWeekend(dateText) {
  const day = new Date(`${dateText}T00:00:00+08:00`).getDay();
  return day === 0 || day === 6;
}

function nextBusinessDay(dateText) {
  let next = addDays(dateText, 1);
  while (isWeekend(next)) next = addDays(next, 1);
  return next;
}

function dateKeyInShanghai(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai'
  });
}

function marketSnapshot(symbol, label, targetDate) {
  return fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Financial-Calendar/1.0' }
  }).then(async (response) => {
    if (!response.ok) return null;
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp || [];
    if (!quote || !timestamps.length) return null;
    const index = timestamps.findIndex((timestamp) => dateKeyInShanghai(timestamp) === targetDate);
    if (index === -1) return null;
    return {
      label,
      symbol,
      date: targetDate,
      close: quote.close?.[index] ?? null,
      open: quote.open?.[index] ?? null,
      high: quote.high?.[index] ?? null,
      low: quote.low?.[index] ?? null,
      volume: quote.volume?.[index] ?? null
    };
  }).catch(() => null);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '未提供';
  return Number(value).toFixed(digits);
}

function summarizeSnapshot(snapshot) {
  if (!snapshot) return '未提供';
  return `${snapshot.label} 收盘 ${formatNumber(snapshot.close)}，开盘 ${formatNumber(snapshot.open)}，最高 ${formatNumber(snapshot.high)}，最低 ${formatNumber(snapshot.low)}，成交量 ${snapshot.volume ?? '未提供'}`;
}

function actualDirection(reviewSnapshot) {
  if (!reviewSnapshot || reviewSnapshot.close === null || reviewSnapshot.open === null) return '无法判断';
  const change = reviewSnapshot.close - reviewSnapshot.open;
  if (change > 0) return '涨';
  if (change < 0) return '跌';
  return '平';
}

function accuracyLabel(forecastDirection, actual) {
  if (forecastDirection === '方向不明' || actual === '无法判断' || actual === '平') return '无法判断';
  if (forecastDirection === '偏涨' && actual === '涨') return '准确';
  if (forecastDirection === '偏跌' && actual === '跌') return '准确';
  return '不准确';
}

function buildReview(positionEvent, previousSnapshot, reviewSnapshot) {
  const analysis = positionEvent.cffexPositionAnalysis;
  const reviewSignal = buildCffexMarketImpact(analysis);
  const reviewDate = nextBusinessDay(analysis.tradeDate);
  const actual = actualDirection(reviewSnapshot);
  const accuracy = accuracyLabel(reviewSignal.forecastDirection, actual);
  const closeChange = reviewSnapshot && reviewSnapshot.close !== null && reviewSnapshot.open !== null
    ? reviewSnapshot.close - reviewSnapshot.open
    : null;

  return {
    tradeDate: analysis.tradeDate,
    reviewDate,
    createdAt: nowChinaLabel(),
    sourceName: 'Yahoo Finance + 中国金融期货交易所',
    sourceUrl: 'https://query1.finance.yahoo.com/',
    forecastDirection: reviewSignal.forecastDirection,
    forecastScore: reviewSignal.forecastScore,
    forecastConfidence: reviewSignal.forecastConfidence,
    actualDirection: actual,
    accuracy,
    accuracySummary: `预测准确度：${accuracy}，实际下一交易日为${actual}。`,
    previousMarketDetail: previousSnapshot,
    reviewMarketDetail: reviewSnapshot,
    closeChange,
    closeChangeText: closeChange === null ? '未提供' : `${closeChange >= 0 ? '+' : ''}${formatNumber(closeChange)}`,
    validationConclusion: `以${analysis.tradeDate}中金所席位信号预测下一交易日${reviewDate}沪深300日内收盘涨跌，预测为${reviewSignal.forecastDirection}，实际为${actual}，结果${accuracy}。`
  };
}

async function main() {
  const requestedDate = argValue('--date') || beijingToday();
  const positionEvents = readJson(positionPath, []);

  const cffexEvents = positionEvents.filter((event) => tradeDateOf(event));
  const latest = requestedDate || cffexEvents.at(-1)?.cffexPositionAnalysis?.tradeDate;
  if (!latest) {
    console.log('CFFEX follow-up review: no source trade date found');
    return;
  }

  const targetPositionEvents = cffexEvents.filter((event) => {
    const tradeDate = tradeDateOf(event);
    return tradeDate <= latest && nextBusinessDay(tradeDate) <= latest;
  });
  const targetEvent = targetPositionEvents.at(-1);
  if (!targetEvent) {
    console.log('CFFEX follow-up review: no eligible target event found');
    return;
  }
  let updated = 0;
  const reviewDate = nextBusinessDay(tradeDateOf(targetEvent));
  const previousSnapshot = await marketSnapshot('000300.SS', '沪深300', tradeDateOf(targetEvent));
  const reviewSnapshot = await marketSnapshot('000300.SS', '沪深300', reviewDate);
  if (reviewSnapshot) {
    targetEvent.cffexPositionAnalysis.followupReview = buildReview(targetEvent, previousSnapshot, reviewSnapshot);
    updated = 1;
  }

  if (updated === 0) {
    console.log('CFFEX follow-up review: no new review event generated');
    return;
  }

  if (!isDryRun) writeJson(positionPath, positionEvents);
  console.log(`CFFEX follow-up review: ${updated} position event(s) updated`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
