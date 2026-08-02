import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const outputPath = path.join(rootDir, 'data/cffex-position-watch.json');

const CFFEX_BASE_URL = 'http://www.cffex.com.cn/fzjy/ccpm';
const isDryRun = process.argv.includes('--dry-run');

const PRODUCTS = [
  { code: 'IH', name: '上证50' },
  { code: 'IF', name: '沪深300' },
  { code: 'IC', name: '中证500' },
  { code: 'IM', name: '中证1000' }
];

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

function beijingToday() {
  const parts = beijingParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function beijingNowLabel() {
  const parts = beijingParts();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} 北京时间`;
}

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function cffexDateParts(dateText) {
  const compact = dateText.replaceAll('-', '');
  return {
    yearMonth: compact.slice(0, 6),
    day: compact.slice(6, 8),
    compact
  };
}

function csvUrl(dateText, productCode) {
  const { yearMonth, day } = cffexDateParts(dateText);
  return `${CFFEX_BASE_URL}/${yearMonth}/${day}/${productCode}_1.csv`;
}

function parseNumber(value) {
  const normalized = String(value || '').replaceAll(',', '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseRankingCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{8},/.test(line))
    .map(parseCsvLine)
    .map((cells) => ({
      tradeDate: cells[0],
      contract: cells[1]?.trim(),
      rank: parseNumber(cells[2]),
      volumeMember: cells[3],
      volume: parseNumber(cells[4]),
      volumeChange: parseNumber(cells[5]),
      longMember: cells[6],
      longPosition: parseNumber(cells[7]),
      longChange: parseNumber(cells[8]),
      shortMember: cells[9],
      shortPosition: parseNumber(cells[10]),
      shortChange: parseNumber(cells[11])
    }));
}

async function fetchProductRows(dateText, product) {
  const url = csvUrl(dateText, product.code);
  const response = await fetch(url, {
    headers: {
      Accept: 'text/csv,*/*',
      'User-Agent': 'Mozilla/5.0 Financial-Calendar/1.0'
    }
  });

  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  const text = new TextDecoder('gb18030').decode(buffer);
  const rows = parseRankingCsv(text);
  if (!rows.length) return null;

  return { product, rows, url };
}

function memberMatchesCitic(memberName) {
  return String(memberName || '').includes('中信期货');
}

function summarizeProduct(productResult) {
  const { product, rows } = productResult;
  let citicLongChange = 0;
  let citicShortChange = 0;
  let top20LongPosition = 0;
  let top20ShortPosition = 0;

  for (const row of rows) {
    if (memberMatchesCitic(row.longMember)) citicLongChange += row.longChange;
    if (memberMatchesCitic(row.shortMember)) citicShortChange += row.shortChange;
    top20LongPosition += row.longPosition;
    top20ShortPosition += row.shortPosition;
  }

  const citicNetChange = citicLongChange - citicShortChange;
  const top20NetPosition = top20LongPosition - top20ShortPosition;

  return {
    product: product.code,
    name: product.name,
    citic: {
      longChange: citicLongChange,
      shortChange: citicShortChange,
      netChange: citicNetChange,
      directionLabel: citicNetChange >= 0 ? '净加多单' : '净加空单',
      directionEmoji: citicNetChange >= 0 ? '🟢' : '🔴'
    },
    top20: {
      longPosition: top20LongPosition,
      shortPosition: top20ShortPosition,
      netPosition: top20NetPosition,
      directionLabel: top20NetPosition >= 0 ? '多单' : '空单',
      directionEmoji: top20NetPosition >= 0 ? '🟢' : '🔴'
    }
  };
}

function directionPhrase(value, positiveLabel, negativeLabel) {
  return value >= 0 ? positiveLabel : negativeLabel;
}

function buildEvent(tradeDateText, results, fetchedAt) {
  const summaries = results.map(summarizeProduct);
  const citicNetChange = summaries.reduce((total, item) => total + item.citic.netChange, 0);
  const top20LongPosition = summaries.reduce((total, item) => total + item.top20.longPosition, 0);
  const top20ShortPosition = summaries.reduce((total, item) => total + item.top20.shortPosition, 0);
  const top20NetPosition = top20LongPosition - top20ShortPosition;
  const citicDirection = directionPhrase(citicNetChange, '净加多单', '净加空单');
  const top20Direction = directionPhrase(top20NetPosition, '多单', '空单');
  const citicEmoji = citicNetChange >= 0 ? '🟢' : '🔴';
  const top20Emoji = top20NetPosition >= 0 ? '🟢' : '🔴';

  return {
    market: 'CN',
    level: 'high',
    levelLabel: '高',
    category: 'Derivatives / CFFEX Position Watch',
    title: `中金所股指期货持仓跟踪：${tradeDateText} 中信${citicDirection}${Math.abs(citicNetChange)}手，前20净${top20Direction}${Math.abs(top20NetPosition)}手`,
    start: `${tradeDateText}T17:00:00+08:00`,
    end: `${tradeDateText}T17:30:00+08:00`,
    timezone: 'Asia/Shanghai',
    location: '中国',
    assets: ['IH上证50', 'IF沪深300', 'IC中证500', 'IM中证1000', 'A股指数期货'],
    timeStatus: 'confirmed',
    sourceName: '中国金融期货交易所',
    sourceUrl: 'http://www.cffex.com.cn/',
    marketExpectation: `中信期货当日${citicDirection}${Math.abs(citicNetChange)}手，前20机构合计净${top20Direction}${Math.abs(top20NetPosition)}手。需要结合指数价格确认期货端变化是否被现货承接。`,
    historicalReaction: '成交持仓排名更适合看资金暴露变化，不适合单独当作方向信号。连续多日同向变化，比单日跳变更有参考价值。',
    actionPlan: `如果中信期货和前20机构同时偏空，指数类仓位需要降低隔夜暴露；如果同时偏多，可以观察是否有现货成交量配合，但不直接追高。当前读数：中信${citicDirection}${Math.abs(citicNetChange)}手，前20净${top20Direction}${Math.abs(top20NetPosition)}手。`,
    reason: '中金所 IH、IF、IC、IM 持仓排名反映股指期货端主力席位的多空暴露和变化，对 A股指数、ETF、期权和隔日风险偏好有参考价值。',
    checklist: ['是否持有指数 ETF 或股指期货相关仓位', '是否观察期货净空是否连续扩大', '是否结合现货成交量和指数强弱确认', '是否避免只看单日席位数据追单'],
    cffexPositionAnalysis: {
      tradeDate: tradeDateText,
      fetchedAt,
      methodology: '中信期货净变化 = 中信期货持买单量增减合计 - 中信期货持卖单量增减合计；前20机构净持仓 = 前20持买单量合计 - 前20持卖单量合计。四个品种均汇总所有合约。',
      sourceFiles: results.map((result) => ({ product: result.product.code, url: result.url })),
      citic: {
        overall: {
          longChange: summaries.reduce((total, item) => total + item.citic.longChange, 0),
          shortChange: summaries.reduce((total, item) => total + item.citic.shortChange, 0),
          netChange: citicNetChange,
          directionLabel: citicDirection,
          directionEmoji: citicEmoji
        },
        details: summaries.map((item) => ({
          product: item.product,
          name: item.name,
          longChange: item.citic.longChange,
          shortChange: item.citic.shortChange,
          netChange: item.citic.netChange,
          directionLabel: item.citic.directionLabel,
          directionEmoji: item.citic.directionEmoji
        }))
      },
      top20: {
        overall: {
          longPosition: top20LongPosition,
          shortPosition: top20ShortPosition,
          netPosition: top20NetPosition,
          directionLabel: top20Direction,
          directionEmoji: top20Emoji
        },
        details: summaries.map((item) => ({
          product: item.product,
          name: item.name,
          longPosition: item.top20.longPosition,
          shortPosition: item.top20.shortPosition,
          netPosition: item.top20.netPosition,
          directionLabel: item.top20.directionLabel,
          directionEmoji: item.top20.directionEmoji
        }))
      }
    }
  };
}

async function fetchCompleteDate(dateText) {
  const results = [];
  for (const product of PRODUCTS) {
    const result = await fetchProductRows(dateText, product);
    if (!result) return null;
    results.push(result);
  }
  return results;
}

async function main() {
  const hasExplicitDate = Boolean(argValue('--date'));
  const requestedDate = argValue('--date') || beijingToday();
  const lookbackDays = Number(argValue('--lookback') || 0);
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0 || lookbackDays > 10) {
    throw new Error('--lookback must be an integer from 0 to 10');
  }
  const fetchedAt = beijingNowLabel();

  for (let offset = 0; offset >= -lookbackDays; offset -= 1) {
    const dateText = addDays(requestedDate, offset);
    const results = await fetchCompleteDate(dateText);
    if (!results) continue;

    const event = buildEvent(dateText, results, fetchedAt);
    if (isDryRun) {
      console.log(JSON.stringify([event], null, 2));
    } else {
      fs.writeFileSync(outputPath, `${JSON.stringify([event], null, 2)}\n`, 'utf8');
    }
    console.log(`CFFEX position watch: ${dateText} ${event.title}`);
    return;
  }

  if (!isDryRun && !fs.existsSync(outputPath)) fs.writeFileSync(outputPath, '[]\n', 'utf8');
  const startDate = addDays(requestedDate, -lookbackDays);
  const range = lookbackDays ? `from ${startDate} to ${requestedDate}` : `for ${requestedDate}`;
  console.log(`CFFEX position watch: no complete IH/IF/IC/IM data found ${range}; ${isDryRun || hasExplicitDate ? 'no production data changed' : 'existing data preserved'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
