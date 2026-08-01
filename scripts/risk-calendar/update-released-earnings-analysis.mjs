import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const earningsPath = path.join(rootDir, 'data/us-megacap-earnings.json');

const LOOKBACK_DAYS = Number(process.env.STAGEB_LOOKBACK_DAYS || 2);
const MAX_EVENTS = Number(process.env.STAGEB_MAX_EVENTS || 8);
const SEARCH_TIMEOUT_MS = 15000;

const OFFICIAL_HOST_HINTS = {
  AAPL: ['apple.com/newsroom'],
  AMZN: ['ir.aboutamazon.com', 'aboutamazon.com/news'],
  MSFT: ['microsoft.com/en-us/investor', 'news.microsoft.com'],
  GOOGL: ['abc.xyz/investor', 'blog.google'],
  GOOG: ['abc.xyz/investor', 'blog.google'],
  META: ['investor.fb.com', 'about.fb.com'],
  NVDA: ['nvidianews.nvidia.com', 'investor.nvidia.com'],
  TSLA: ['ir.tesla.com'],
  JPM: ['jpmorganchase.com/ir'],
  BAC: ['investor.bankofamerica.com'],
  JNJ: ['investor.jnj.com'],
  UNH: ['unitedhealthgroup.com/investors'],
  INTC: ['intel.com/content/www/us/en/newsroom', 'intc.com'],
  KO: ['coca-colacompany.com/media-center', 'investors.coca-colacompany.com'],
  V: ['investor.visa.com'],
  LRCX: ['investor.lamresearch.com'],
  MA: ['investor.mastercard.com'],
  XOM: ['corporate.exxonmobil.com/news', 'investor.exxonmobil.com'],
  ABBV: ['news.abbvie.com', 'investors.abbvie.com'],
  CVX: ['chevron.com/newsroom', 'investors.chevron.com'],
  CAT: ['investors.caterpillar.com'],
  AMD: ['ir.amd.com'],
  LLY: ['investor.lilly.com'],
  CSCO: ['newsroom.cisco.com', 'investor.cisco.com'],
  AMAT: ['appliedmaterials.com/us/en/about/newsroom', 'ir.appliedmaterials.com'],
  WMT: ['corporate.walmart.com/news', 'stock.walmart.com'],
  BRK: ['berkshirehathaway.com'],
  'BRK.B': ['berkshirehathaway.com']
};

function readEvents() {
  if (!fs.existsSync(earningsPath)) return [];
  return JSON.parse(fs.readFileSync(earningsPath, 'utf8'));
}

function writeEvents(events) {
  fs.writeFileSync(earningsPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
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

function compactDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '';
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
}

function currentChinaCompact() {
  const p = beijingParts();
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

function windowStartCompact() {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - LOOKBACK_DAYS);
  const p = beijingParts(now);
  return `${p.year}${p.month}${p.day}T000000`;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPublishedDate(html) {
  const source = String(html || '');
  const metaPatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']publishdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i
  ];

  for (const pattern of metaPatterns) {
    const match = source.match(pattern);
    if (match) return new Date(match[1]);
  }

  return null;
}

function eventDateUtc(event) {
  const day = String(event.start).slice(0, 10);
  return new Date(`${day}T00:00:00Z`);
}

function withinDays(a, b, days) {
  if (!(a instanceof Date) || Number.isNaN(a.getTime()) || !(b instanceof Date) || Number.isNaN(b.getTime())) return false;
  const diff = Math.abs(a.getTime() - b.getTime());
  return diff <= days * 24 * 60 * 60 * 1000;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 Financial-Calendar/1.0'
      }
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function searchUrl(query) {
  return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

function extractSearchLinks(htmlText) {
  const urls = new Set();
  const hrefMatches = String(htmlText).match(/href="([^"]+)"/g) || [];
  for (const href of hrefMatches) {
    try {
      const value = href.match(/href="([^"]+)"/)?.[1] || '';
      const decoded = decodeURIComponent(value.replace(/&amp;/g, '&'));
      const urlParam = decoded.match(/[?&]uddg=([^&]+)/)?.[1];
      const url = urlParam ? decodeURIComponent(urlParam) : decoded;
      if (/https?:\/\//.test(url)) urls.add(url.replace(/[),.]+$/, ''));
    } catch {
      // Ignore malformed links from search markup.
    }
  }
  return Array.from(urls).slice(0, 12);
}

function officialScore(url, event) {
  const lower = url.toLowerCase();
  const hints = OFFICIAL_HOST_HINTS[event.ticker] || [];
  let score = 0;
  for (const hint of hints) if (lower.includes(hint.toLowerCase())) score += 10;
  if (/earnings|results|quarter|financial|investor|news-release|newsroom/.test(lower)) score += 3;
  if (/sec\.gov|nasdaq\.com|finance\.yahoo|marketwatch|benzinga|seekingalpha/.test(lower)) score -= 6;
  return score;
}

function officialSiteQueries(event) {
  const hints = OFFICIAL_HOST_HINTS[event.ticker] || [];
  return hints.map((hint) => {
    const siteHost = hint.split('/')[0];
    return `site:${siteHost} ${event.companyEnglishName} earnings release ${event.ticker}`;
  });
}

async function findCandidatePages(event) {
  const queries = [
    ...officialSiteQueries(event),
    `${event.companyEnglishName} ${event.ticker} earnings release`,
    `${event.companyEnglishName} investor relations ${event.ticker} quarterly results`,
    `${event.companyEnglishName} press release earnings ${event.ticker}`
  ];
  const links = new Set();

  for (const query of queries) {
    const pageHtml = await fetchHtml(searchUrl(query));
    for (const link of extractSearchLinks(pageHtml)) links.add(link);
  }

  return Array.from(links)
    .map((url) => ({ url, score: officialScore(url, event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.url);
}

function parseDollarNumber(value) {
  const match = String(value || '').replace(/,/g, '').match(/\$?(-?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function formatMoney(value) {
  return value === null || Number.isNaN(value) ? '未提供' : `$${value.toFixed(2).replace(/\.00$/, '')}`;
}

function extractActuals(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  const epsMatch = normalized.match(/(?:diluted\s+)?(?:earnings per share|eps)[^$\d-]{0,80}\$?(-?\d+(?:\.\d+)?)/i)
    || normalized.match(/\$(-?\d+(?:\.\d+)?)\s+(?:diluted\s+)?(?:earnings per share|eps)/i);
  const revenueMatch = normalized.match(/(?:revenue|net sales|revenues)[^$\d]{0,80}\$([\d,.]+)\s*(billion|million)/i)
    || normalized.match(/\$([\d,.]+)\s*(billion|million)[^\.]{0,80}(?:revenue|net sales|revenues)/i);
  const yoyMatch = normalized.match(/(?:revenue|net sales|revenues)[^\.]{0,140}(?:up|increased|grew|rose)\s+([\d.]+)%/i);

  return {
    dilutedEps: epsMatch ? formatMoney(Number(epsMatch[1])) : '未提供',
    revenue: revenueMatch ? `$${revenueMatch[1]} ${revenueMatch[2].toLowerCase()}` : '未提供',
    revenueYoY: yoyMatch ? `+${yoyMatch[1]}%` : '未提供'
  };
}

function classifyExpectation(actualEps, expectedEps) {
  const actual = parseDollarNumber(actualEps);
  const expected = parseDollarNumber(expectedEps);
  if (actual === null || expected === null || expected === 0) return null;

  const diff = actual - expected;
  const pct = diff / Math.abs(expected) * 100;
  let conclusion = '符合预期';
  if (pct >= 5) conclusion = '大幅超预期';
  else if (pct > 0) conclusion = '小幅超预期';
  else if (pct <= -5) conclusion = '大幅不及预期';
  else if (pct < 0) conclusion = '小幅不及预期';

  return {
    metric: '摊薄每股收益（EPS）',
    marketExpectation: eventValue(expectedEps),
    actualResult: eventValue(actualEps),
    absoluteDifference: `${diff >= 0 ? '+' : '-'}$${Math.abs(diff).toFixed(2)}`,
    percentageDifference: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    verdict: conclusion.includes('超预期') ? `高于预期；${conclusion}。` : conclusion.includes('不及') ? `低于预期；${conclusion}。` : '符合预期。',
    conclusion
  };
}

function eventValue(value) {
  return value || '未提供';
}

function buildStageB(event, sourceUrl, sourceText, actuals) {
  const expectation = classifyExpectation(actuals.dilutedEps, event.consensusEps);
  if (!expectation) return null;

  const companyLabel = `${event.companyChineseName}（${event.companyEnglishName}，${event.ticker}）`;
  const reason = `实际 EPS 为 ${actuals.dilutedEps}，纳斯达克共识 EPS 为 ${event.consensusEps}，预期差为 ${expectation.absoluteDifference}（${expectation.percentageDifference}）。营收披露为 ${actuals.revenue}，同比为 ${actuals.revenueYoY}。`;

  return {
    reportedFinancials: {
      sourceName: '公司官方财报新闻稿 / 投资者关系页面',
      sourceUrl,
      periodEnded: event.nasdaqCalendarFields?.fiscalQuarterEndingLabel || event.fiscalQuarter || '未提供',
      revenue: actuals.revenue,
      revenueYoY: actuals.revenueYoY,
      grossMargin: '未提供',
      grossMarginNote: '自动抓取正文未提取到可验证毛利率字段，需阅读完整财报表格补充。',
      dilutedEps: actuals.dilutedEps,
      dilutedEpsYoY: '未提供',
      dilutedEpsNote: '来自自动抓取的官方财报正文；如公司同时披露 GAAP/Non-GAAP EPS，需要人工复核口径。',
      dividend: '未提供',
      dividendRecordDate: '未提供',
      dividendPayableDate: '未提供',
      operatingCashFlowComment: '自动抓取正文未提取到可验证经营现金流金额，需阅读完整现金流量表补充。',
      managementQuoteSummary: sourceText.slice(0, 420)
    },
    stageBAnalysis: {
      expectationGapConclusion: expectation.conclusion,
      expectationSummary: {
        metric: expectation.metric,
        marketExpectation: expectation.marketExpectation,
        actualResult: expectation.actualResult,
        absoluteDifference: expectation.absoluteDifference,
        percentageDifference: expectation.percentageDifference,
        adjustedActualResult: '未提供',
        adjustedDifference: '未提供',
        adjustmentNote: '自动抓取未识别一次性调整项目；需要电话会、10-Q 或完整财报表格进一步复核。',
        verdict: expectation.verdict
      },
      expectationGapReason: reason,
      incomeStatementAnalysis: `利润表初步看，${companyLabel} 本次披露营收为 ${actuals.revenue}，EPS 为 ${actuals.dilutedEps}。当前自动化能验证 EPS 预期差，但收入结构、成本项和利润率仍需完整报表补充。`,
      balanceSheetAnalysis: '自动抓取正文未提取到现金、债务、应收、库存等资产负债表关键项，暂不能判断资产质量变化。',
      cashFlowAnalysis: '自动抓取正文未提取到经营现金流、资本开支和自由现金流金额，暂不能定量验证盈利质量。',
      managementOutlookAnalysis: '自动抓取正文未稳定识别管理层完整指引，需补充电话会或公司指引段落后确认短期波动还是长期逻辑变化。',
      priceActionAnalysis: '当前自动化未接入财报前后股价、成交量和期权隐含波动率，暂不能完整推演资金博弈方向。',
      highlights: [
        `实际 EPS ${actuals.dilutedEps}，对比纳斯达克共识 ${event.consensusEps}。`,
        `营收 ${actuals.revenue}，同比 ${actuals.revenueYoY}。`,
        '已定位到公司官方财报正文来源，阶段B记录可留存追踪。'
      ],
      risks: [
        '自动提取字段有限，完整三张表仍需补充。',
        '如公司披露 GAAP 与 Non-GAAP 两套 EPS，需要人工确认比较口径。',
        '未接入盘后/盘前价格反应，短线判断仍需结合市场成交验证。'
      ],
      shortTermTradingView: `${expectation.conclusion}。短线优先观察常规交易时段缺口、成交量和相关 ETF 是否确认方向，不用单一 EPS 结论追单。`,
      longTermFundamentalView: '当前只完成官方正文初步抽取和 EPS 预期差判断；中长期判断需要补充收入结构、利润率、现金流、资产负债表和管理层指引。',
      missingData: ['完整利润表', '完整资产负债表', '完整现金流量表', '管理层电话会指引', '财报前后股价与成交量反应']
    }
  };
}

function isPendingReleasedEvent(event) {
  if (event.analysisPhase !== 'B') return false;
  if (event.reportedFinancials && event.stageBAnalysis) return false;
  const start = compactDateTime(event.start);
  return start >= windowStartCompact() && start < currentChinaCompact();
}

async function isStaleCompletedEvent(event) {
  if (event.analysisPhase !== 'B') return false;
  if (!event.reportedFinancials?.sourceUrl || !event.stageBAnalysis) return false;
  const sourceHtml = await fetchHtml(event.reportedFinancials.sourceUrl);
  const publishedAt = extractPublishedDate(sourceHtml);
  if (!publishedAt) return false;
  return !withinDays(publishedAt, eventDateUtc(event), 45);
}

async function enrichEvent(event) {
  const pages = await findCandidatePages(event);
  for (const url of pages) {
    const html = await fetchHtml(url);
    const publishedAt = extractPublishedDate(html);
    if (!publishedAt || !withinDays(publishedAt, eventDateUtc(event), 45)) continue;
    const text = stripHtml(html);
    if (!/earnings|results|revenue|net sales|eps|earnings per share/i.test(text)) continue;
    const actuals = extractActuals(text);
    if (actuals.dilutedEps === '未提供' || actuals.revenue === '未提供') continue;
    const stageB = buildStageB(event, url, text, actuals);
    if (!stageB) continue;

    return {
      ...event,
      ...stageB,
      recordStatus: '已归档：阶段B分析已生成',
      analysisLocked: true,
      analysisUpdatedAt: nowChinaLabel(),
      archivedAt: event.archivedAt || nowChinaLabel(),
      stageBFetchStatus: '已自动抓取官方财报正文并生成阶段B复盘',
      stageBFetchCheckedAt: nowChinaLabel()
    };
  }

  return {
    ...event,
    recordStatus: '待补充：阶段B财报正文与复盘分析',
    analysisLocked: false,
    stageBFetchStatus: `未找到可验证的官方财报正文；已搜索 ${pages.length} 个候选页面`,
    stageBFetchCheckedAt: nowChinaLabel()
  };
}

async function main() {
  const events = readEvents();
  const scanCandidates = [];

  for (const [index, event] of events.entries()) {
    if (await isStaleCompletedEvent(event)) {
      scanCandidates.push({ event, index, reason: 'stale' });
    }
  }

  for (const [index, event] of events.entries()) {
    if (isPendingReleasedEvent(event)) {
      scanCandidates.push({ event, index, reason: 'pending' });
    }
  }

  const pendingIndexes = scanCandidates
    .filter(({ event }, index, array) => array.findIndex((item) => item.event.ticker === event.ticker) === index)
    .slice(0, MAX_EVENTS);

  console.log(`Released earnings pending Stage B enrichment: ${pendingIndexes.length}`);
  let updated = 0;

  for (const item of pendingIndexes) {
    const next = await enrichEvent(item.event);
    if (JSON.stringify(next) !== JSON.stringify(item.event)) {
      events[item.index] = next;
      updated += 1;
      console.log(`${next.ticker}: ${item.reason} -> ${next.stageBFetchStatus}`);
    }
  }

  if (updated > 0) writeEvents(events);
  console.log(`Stage B enrichment updated records: ${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
