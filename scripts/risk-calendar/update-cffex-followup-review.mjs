import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCffexMarketImpact } from './cffex-market-impact.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const positionPath = path.join(rootDir, 'data/cffex-position-watch.json');
const outputPath = path.join(rootDir, 'data/cffex-followup-review.json');
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

function reviewTradeDateOf(event) {
  return event?.cffexFollowupReview?.tradeDate || '';
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
  return fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=10d&interval=1d`, {
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

function compareReview(reviewSignal, snapshot) {
  if (!reviewSignal || !snapshot || snapshot.close === null || snapshot.open === null) return '数据不足，无法严格验证。';
  const change = snapshot.close - snapshot.open;
  const direction = change > 0 ? '偏涨' : change < 0 ? '偏跌' : '横盘';
  const sign = reviewSignal.forecastDirection === '方向不明' ? '不明' : reviewSignal.forecastDirection;
  let verdict = '部分一致';
  if ((sign === '偏涨' && change > 0) || (sign === '偏跌' && change < 0)) verdict = '一致';
  if ((sign === '偏涨' && change < 0) || (sign === '偏跌' && change > 0)) verdict = '相反';
  return `复盘结果：${verdict}。席位信号偏向${sign}，次日收盘呈${direction}，开收变化为 ${change >= 0 ? '+' : ''}${formatNumber(change)}。`;
}

function mergeReviewEvents(existingEvents, incomingEvent) {
  const incomingDate = reviewTradeDateOf(incomingEvent);
  if (!incomingDate) throw new Error('CFFEX follow-up review is missing tradeDate');

  const byDate = new Map();
  for (const event of Array.isArray(existingEvents) ? existingEvents : []) {
    const tradeDate = reviewTradeDateOf(event);
    if (tradeDate) byDate.set(tradeDate, event);
  }
  byDate.set(incomingDate, incomingEvent);

  return [...byDate.values()].sort((left, right) => reviewTradeDateOf(left).localeCompare(reviewTradeDateOf(right)));
}

function buildEvent(positionEvent, snapshot) {
  const analysis = positionEvent.cffexPositionAnalysis;
  const reviewSignal = buildCffexMarketImpact(analysis);
  const reviewDate = nextBusinessDay(analysis.tradeDate);
  const reviewLabel = reviewDate;
  const verdict = compareReview(reviewSignal, snapshot);
  const baseConclusion = `基于前一交易日中金所席位与次日大盘收盘对比，${verdict}`;

  return {
    market: 'CN',
    level: 'high',
    levelLabel: '高',
    category: 'Derivatives / CFFEX Follow-up Review',
    title: `中金所次日收盘复盘：${analysis.tradeDate} -> ${reviewLabel}`,
    start: `${reviewDate}T15:30:00+08:00`,
    end: `${reviewDate}T16:00:00+08:00`,
    timezone: 'Asia/Shanghai',
    location: '中国',
    assets: ['沪深300', '上证指数', '深证成指', '中金所股指期货'],
    timeStatus: 'confirmed',
    sourceName: 'Yahoo Finance + 中国金融期货交易所',
    sourceUrl: 'https://query1.finance.yahoo.com/',
    marketExpectation: `前一交易日中金所信号：${reviewSignal.directionalConclusion}。`,
    historicalReaction: '次日收盘复盘用于验证席位信号是否被价格确认，避免把单日净多净空直接等同于确定方向。',
    actionPlan: '先看次日收盘是否与席位方向一致，再决定是否提高信号权重；如果价格与席位相反，说明前一交易日的席位变化更像噪音或对冲而不是方向押注。',
    reason: '把前一交易日中金所持仓与次日收盘表现放在一起，才能验证席位信号是否真的得到价格确认。',
    checklist: ['是否对照了前一交易日中金所席位', '是否查看了次日收盘而不是盘中噪音', '是否重新校准对净多/净空的信号权重'],
    cffexFollowupReview: {
      tradeDate: analysis.tradeDate,
      reviewDate,
      createdAt: nowChinaLabel(),
      signal: {
        forecastDirection: reviewSignal.forecastDirection,
        forecastScore: reviewSignal.forecastScore,
        forecastConfidence: reviewSignal.forecastConfidence,
        directionalConclusion: reviewSignal.directionalConclusion,
        positionNature: reviewSignal.positionNature,
        positionExplanation: reviewSignal.positionExplanation,
        forecastBasis: reviewSignal.forecastBasis
      },
      marketDetail: snapshot,
      validationSummary: verdict,
      validationConclusion: baseConclusion
    }
  };
}

async function main() {
  const requestedDate = argValue('--date') || '';
  const positionEvents = readJson(positionPath, []);
  const reviewEvents = [];
  const existing = readJson(outputPath, []);
  const existingDates = new Set(existing.map((event) => reviewTradeDateOf(event)).filter(Boolean));

  const cffexEvents = positionEvents.filter((event) => tradeDateOf(event));
  const latest = requestedDate || cffexEvents.at(-1)?.cffexPositionAnalysis?.tradeDate;
  if (!latest) {
    if (!isDryRun && !fs.existsSync(outputPath)) writeJson(outputPath, []);
    console.log('CFFEX follow-up review: no source trade date found');
    return;
  }

  const targetPositionEvents = cffexEvents.filter((event) => tradeDateOf(event) <= latest && !existingDates.has(tradeDateOf(event)));
  for (const event of targetPositionEvents.slice(-3)) {
    const reviewDate = nextBusinessDay(tradeDateOf(event));
    const snapshot = await marketSnapshot('000300.SS', '沪深300', reviewDate);
    const reviewEvent = buildEvent(event, snapshot ? { ...snapshot, label: '沪深300' } : null);
    reviewEvents.push(reviewEvent);
    existingDates.add(tradeDateOf(event));
  }

  if (reviewEvents.length === 0) {
    if (!isDryRun && !fs.existsSync(outputPath)) writeJson(outputPath, []);
    console.log('CFFEX follow-up review: no new review event generated');
    return;
  }

  let merged = Array.isArray(existing) ? [...existing] : [];
  for (const event of reviewEvents) merged = mergeReviewEvents(merged, event);
  if (!isDryRun) writeJson(outputPath, merged);
  console.log(`CFFEX follow-up review: ${reviewEvents.length} event(s) updated`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
