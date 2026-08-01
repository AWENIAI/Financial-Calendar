import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const outputPath = path.join(rootDir, 'data/us-megacap-earnings.json');

const LOOKAHEAD_DAYS = 30;
const LOOKBACK_DAYS = 30;
const NASDAQ_EARNINGS_URL = 'https://api.nasdaq.com/api/calendar/earnings';

const WATCHLIST = [
  { symbol: 'AAPL', chineseName: '苹果', englishName: 'Apple' },
  { symbol: 'NVDA', chineseName: '英伟达', englishName: 'NVIDIA' },
  { symbol: 'GOOGL', chineseName: '谷歌母公司 Alphabet', englishName: 'Alphabet', aliases: ['GOOG'] },
  { symbol: 'MSFT', chineseName: '微软', englishName: 'Microsoft' },
  { symbol: 'AMZN', chineseName: '亚马逊', englishName: 'Amazon' },
  { symbol: 'AVGO', chineseName: '博通', englishName: 'Broadcom' },
  { symbol: 'SPCX', chineseName: 'SpaceX', englishName: 'SpaceX' },
  { symbol: 'META', chineseName: 'Meta 平台', englishName: 'Meta Platforms' },
  { symbol: 'TSLA', chineseName: '特斯拉', englishName: 'Tesla' },
  { symbol: 'BRK.B', chineseName: '伯克希尔哈撒韦', englishName: 'Berkshire Hathaway', aliases: ['BRK/B', 'BRK.B'] },
  { symbol: 'LLY', chineseName: '礼来', englishName: 'Eli Lilly' },
  { symbol: 'MU', chineseName: '美光科技', englishName: 'Micron' },
  { symbol: 'JPM', chineseName: '摩根大通', englishName: 'JPMorgan Chase' },
  { symbol: 'WMT', chineseName: '沃尔玛', englishName: 'Walmart' },
  { symbol: 'AMD', chineseName: 'AMD', englishName: 'AMD' },
  { symbol: 'V', chineseName: '维萨', englishName: 'Visa' },
  { symbol: 'XOM', chineseName: '埃克森美孚', englishName: 'Exxon Mobil' },
  { symbol: 'JNJ', chineseName: '强生', englishName: 'Johnson & Johnson' },
  { symbol: 'MA', chineseName: '万事达卡', englishName: 'Mastercard' },
  { symbol: 'INTC', chineseName: '英特尔', englishName: 'Intel' },
  { symbol: 'ABBV', chineseName: '艾伯维', englishName: 'AbbVie' },
  { symbol: 'CSCO', chineseName: '思科', englishName: 'Cisco' },
  { symbol: 'BAC', chineseName: '美国银行', englishName: 'Bank of America' },
  { symbol: 'COST', chineseName: '好市多', englishName: 'Costco' },
  { symbol: 'AMAT', chineseName: '应用材料', englishName: 'Applied Materials' },
  { symbol: 'CVX', chineseName: '雪佛龙', englishName: 'Chevron' },
  { symbol: 'UNH', chineseName: '联合健康', englishName: 'UnitedHealth' },
  { symbol: 'KO', chineseName: '可口可乐', englishName: 'Coca-Cola' },
  { symbol: 'CAT', chineseName: '卡特彼勒', englishName: 'Caterpillar' },
  { symbol: 'LRCX', chineseName: '泛林集团', englishName: 'Lam Research' }
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

function nowChinaCompactDateTime() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}T${values.hour}${values.minute}${values.second}`;
}

function nowChinaLabel() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} 北京时间`;
}

function compactDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Invalid datetime: ${value}`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
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

function formatFiscalQuarter(value) {
  const monthMap = {
    Jan: '1月',
    Feb: '2月',
    Mar: '3月',
    Apr: '4月',
    May: '5月',
    Jun: '6月',
    Jul: '7月',
    Aug: '8月',
    Sep: '9月',
    Oct: '10月',
    Nov: '11月',
    Dec: '12月'
  };
  const match = String(value || '').match(/^([A-Za-z]{3})\/(\d{4})$/);
  if (!match) return value || '最近季度';
  return `${match[2]}年${monthMap[match[1]] || match[1]}`;
}

function normalizeField(value) {
  if (value === undefined || value === null || value === '' || value === 'N/A') return '未提供';
  return String(value);
}

function timeLabel(nasdaqTime) {
  return {
    'time-pre-market': '美股盘前',
    'time-after-hours': '美股盘后',
    'time-not-supplied': '未提供具体时间'
  }[nasdaqTime] || normalizeField(nasdaqTime);
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

function eventKey(event) {
  return [event.ticker || event.assets?.[0], event.fiscalQuarter || '', event.start?.slice(0, 10)].join('|');
}

function readExistingEvents() {
  if (!fs.existsSync(outputPath)) return [];
  return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

function withoutVolatileMetadata(event) {
  const { lastFetchedAt, ...stableEvent } = event || {};
  return stableEvent;
}

function stableEventChanged(existing, fetched) {
  if (!existing) return true;
  return JSON.stringify(withoutVolatileMetadata(existing)) !== JSON.stringify(withoutVolatileMetadata({ ...existing, ...fetched }));
}

function finalizeRecord(event, runLabel) {
  if (event.analysisPhase === 'B') {
    return {
      ...event,
      recordStatus: '已归档：阶段B分析已生成',
      analysisLocked: true,
      analysisUpdatedAt: event.analysisUpdatedAt || runLabel,
      archivedAt: event.archivedAt || runLabel
    };
  }

  return {
    ...event,
    recordStatus: '跟踪中：阶段A财报发布前',
    analysisLocked: false,
    lastFetchedAt: event.lastFetchedAt || runLabel
  };
}

function mergeEvents(existingEvents, fetchedEvents, runLabel) {
  const merged = new Map();

  for (const existing of existingEvents) {
    if (!existing.analysisLocked && !WATCHLIST_BY_SYMBOL.has(normalizeSymbol(existing.ticker || existing.assets?.[0]))) continue;
    merged.set(eventKey(existing), existing);
  }

  for (const fetched of fetchedEvents) {
    const key = eventKey(fetched);
    const existing = merged.get(key);

    if (existing?.analysisLocked) continue;

    if (!stableEventChanged(existing, fetched)) continue;

    merged.set(key, finalizeRecord({ ...existing, ...fetched }, runLabel));
  }

  for (const [key, event] of merged) {
    if (event.analysisLocked) continue;

    const phase = compactDateTime(event.start) < nowChinaCompactDateTime() ? 'B' : 'A';
    if (phase === 'B') {
      merged.set(key, finalizeRecord({
        ...event,
        analysisPhase: 'B',
        analysisPhaseLabel: '阶段B：财报发布后'
      }, runLabel));
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

function eventFromRow(row, rowDate, company) {
  const timing = earningsWindow(rowDate, row.time);
  const quarter = formatFiscalQuarter(row.fiscalQuarterEnding);
  const eps = normalizeField(row.epsForecast);
  const estimates = normalizeField(row.noOfEsts);
  const companyLabel = `${company.chineseName}（${company.englishName}，${company.symbol}）`;
  const phase = compactDateTime(timing.start) < nowChinaCompactDateTime() ? 'B' : 'A';

  return {
    market: 'US',
    level: 'high',
    levelLabel: '高',
    category: 'Earnings / US Megacap',
    title: `${companyLabel}财报发布：${quarter}`,
    start: timing.start,
    end: timing.end,
    timezone: 'Asia/Shanghai',
    location: '美国',
    assets: [company.symbol, 'QQQ', 'SPY', '纳斯达克100'],
    companyChineseName: company.chineseName,
    companyEnglishName: company.englishName,
    ticker: company.symbol,
    fiscalQuarter: quarter,
    consensusEps: eps,
    analystCount: estimates,
    analysisPhase: phase,
    analysisPhaseLabel: phase === 'A' ? '阶段A：财报发布前' : '阶段B：财报发布后',
    nasdaqCalendarFields: {
      time: normalizeField(row.time),
      timeLabel: timeLabel(row.time),
      symbol: normalizeField(row.symbol),
      companyName: normalizeField(row.name),
      marketCap: normalizeField(row.marketCap),
      fiscalQuarterEnding: normalizeField(row.fiscalQuarterEnding),
      fiscalQuarterEndingLabel: quarter,
      epsForecast: eps,
      noOfEsts: estimates,
      lastYearRptDt: normalizeField(row.lastYearRptDt),
      lastYearEPS: normalizeField(row.lastYearEPS)
    },
    timeStatus: timing.status,
    sourceName: '纳斯达克财报日历',
    sourceUrl: 'https://www.nasdaq.com/market-activity/earnings',
    marketExpectation: `市场会重点看营收、利润率、指引和管理层措辞。当前纳斯达克共识每股收益为 ${eps}，覆盖分析师数量为 ${estimates}。`,
    historicalReaction: '美股超大市值公司财报常会影响指数权重、行业链条和盘后期货，财报后第一个常规交易时段更容易放大波动。',
    actionPlan: '财报前避免临时加重仓；如果已有仓位，先确认能承受盘后跳空。财报出来后优先看指引和盘后成交反应，再决定是否调整。',
    reason: `${companyLabel}是订阅股票池 30 个重点美股标的之一，财报可能影响相关行业、QQQ/SPY 权重和市场风险偏好。`,
    checklist: ['是否持有该股或相关 ETF', '是否能承受盘后跳空', '是否需要提前降低仓位', '是否关注财报后指引']
  };
}

async function main() {
  const runLabel = nowChinaLabel();
  const existingEvents = readExistingEvents();
  const from = startDate();
  const windowStartDate = addDays(from, -LOOKBACK_DAYS);
  const windowStart = compactDateTime(withChinaTimezone(isoDate(windowStartDate), '00:00'));
  const windowEnd = compactDateTime(withChinaTimezone(isoDate(addDays(from, LOOKAHEAD_DAYS)), '23:59'));
  const fetchedByKey = new Map();

  for (let offset = -LOOKBACK_DAYS; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const date = isoDate(addDays(from, offset));
    const rows = await fetchEarningsRows(date);

    for (const row of rows) {
      const symbol = normalizeSymbol(row.symbol);
      const company = WATCHLIST_BY_SYMBOL.get(symbol);
      if (!company) continue;

      const event = eventFromRow(row, date, company);
      const eventStart = compactDateTime(event.start);
      if (eventStart < windowStart || eventStart > windowEnd) continue;

      const key = eventKey(event);
      const previous = fetchedByKey.get(key);
      if (!previous || event.start.localeCompare(previous.start) < 0) {
        fetchedByKey.set(key, event);
      }
    }
  }

  const fetchedEvents = Array.from(fetchedByKey.values());
  const events = mergeEvents(existingEvents, fetchedEvents, runLabel);
  const lockedCount = events.filter((event) => event.analysisLocked).length;
  fs.writeFileSync(outputPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
  console.log(`US megacap earnings: ${events.length} retained events; ${fetchedEvents.length} fetched from last ${LOOKBACK_DAYS} days to next ${LOOKAHEAD_DAYS} days; ${lockedCount} locked archive records`);
  for (const event of events) console.log(`${event.start.slice(0, 10)} ${event.ticker} ${event.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
