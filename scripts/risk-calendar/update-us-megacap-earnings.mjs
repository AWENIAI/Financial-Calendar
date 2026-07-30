import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const outputPath = path.join(rootDir, 'data/us-megacap-earnings.json');

const LOOKAHEAD_DAYS = 30;
const NASDAQ_EARNINGS_URL = 'https://api.nasdaq.com/api/calendar/earnings';

const WATCHLIST = [
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet', aliases: ['GOOG'] },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', aliases: ['BRK/B', 'BRK.B'] },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'WMT', name: 'Walmart' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'ORCL', name: 'Oracle' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'COST', name: 'Costco' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'HD', name: 'Home Depot' }
];

const WATCHLIST_BY_SYMBOL = new Map();
for (const company of WATCHLIST) {
  WATCHLIST_BY_SYMBOL.set(company.symbol, company);
  for (const alias of company.aliases || []) WATCHLIST_BY_SYMBOL.set(alias, company);
}

function beijingDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function startDate() {
  const parts = beijingDateParts();
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function withChinaTimezone(date, time) {
  return `${date}T${time}:00+08:00`;
}

function earningsWindow(rowDate, nasdaqTime) {
  if (nasdaqTime === 'time-after-hours') {
    const nextChinaDate = isoDate(addDays(new Date(`${rowDate}T00:00:00Z`), 1));
    return {
      start: withChinaTimezone(nextChinaDate, '04:05'),
      end: withChinaTimezone(nextChinaDate, '04:35'),
      status: 'confirmed'
    };
  }

  if (nasdaqTime === 'time-pre-market') {
    return {
      start: withChinaTimezone(rowDate, '20:30'),
      end: withChinaTimezone(rowDate, '21:00'),
      status: 'confirmed'
    };
  }

  return {
    start: withChinaTimezone(rowDate, '21:30'),
    end: withChinaTimezone(rowDate, '22:00'),
    status: 'estimated'
  };
}

async function fetchEarningsRows(date) {
  const url = `${NASDAQ_EARNINGS_URL}?date=${date}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 Financial-Calendar/1.0'
    }
  });

  if (!response.ok) throw new Error(`Nasdaq earnings request failed for ${date}: ${response.status}`);
  const payload = await response.json();
  return payload?.data?.rows || [];
}

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function eventFromRow(row, rowDate, company) {
  const timing = earningsWindow(rowDate, row.time);
  const quarter = row.fiscalQuarterEnding || '最近季度';
  const eps = row.epsForecast && row.epsForecast !== 'N/A' ? row.epsForecast : '未提供';
  const estimates = row.noOfEsts && row.noOfEsts !== 'N/A' ? row.noOfEsts : '未提供';

  return {
    market: 'US',
    level: 'high',
    levelLabel: '高',
    category: 'Earnings / US Megacap',
    title: `${company.name}（${company.symbol}）财报发布：${quarter}`,
    start: timing.start,
    end: timing.end,
    timezone: 'Asia/Shanghai',
    location: '美国',
    assets: [company.symbol, 'QQQ', 'SPY', '纳斯达克100'],
    timeStatus: timing.status,
    sourceName: 'Nasdaq Earnings Calendar',
    sourceUrl: 'https://www.nasdaq.com/market-activity/earnings',
    marketExpectation: `市场会重点看营收、利润率、指引和管理层措辞。当前 Nasdaq 共识 EPS 为 ${eps}，覆盖分析师数量为 ${estimates}。`,
    historicalReaction: '美股超大市值公司财报常会影响指数权重、行业链条和盘后期货，财报后第一个常规交易时段更容易放大波动。',
    actionPlan: '财报前避免临时加重仓；如果已有仓位，先确认能承受盘后跳空。财报出来后优先看指引和盘后成交反应，再决定是否调整。',
    reason: `${company.name} 是美股前 20 大市值公司之一，财报可能影响相关行业、QQQ/SPY 权重和市场风险偏好。`,
    checklist: ['是否持有该股或相关 ETF', '是否能承受盘后跳空', '是否需要提前降低仓位', '是否关注财报后指引']
  };
}

async function main() {
  const from = startDate();
  const eventsBySymbol = new Map();

  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const date = isoDate(addDays(from, offset));
    const rows = await fetchEarningsRows(date);

    for (const row of rows) {
      const symbol = normalizeSymbol(row.symbol);
      const company = WATCHLIST_BY_SYMBOL.get(symbol);
      if (!company) continue;

      const event = eventFromRow(row, date, company);
      const previous = eventsBySymbol.get(company.symbol);
      if (!previous || event.start.localeCompare(previous.start) < 0) {
        eventsBySymbol.set(company.symbol, event);
      }
    }
  }

  const events = Array.from(eventsBySymbol.values()).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  fs.writeFileSync(outputPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
  console.log(`US megacap earnings: ${events.length} events in next ${LOOKAHEAD_DAYS} days`);
  for (const event of events) console.log(`${event.start.slice(0, 10)} ${event.assets[0]} ${event.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
