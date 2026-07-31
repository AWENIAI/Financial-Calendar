import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const dataPath = path.join(rootDir, 'data/risk-events.json');
const fixedEventsPath = path.join(rootDir, 'data/fixed-events-2026.json');
const usMegacapEarningsPath = path.join(rootDir, 'data/us-megacap-earnings.json');
const outputDir = path.join(rootDir, 'public/calendar');

const LEVEL_META = {
  critical: {
    emoji: '🔴',
    label: '极高',
    alarmTriggers: ['-P1D', '-PT30M']
  },
  high: {
    emoji: '🟠',
    label: '高',
    alarmTriggers: ['-PT1H']
  }
};

const CALENDARS = [
  {
    file: 'GLOBAL_KEY.ics',
    name: '阿文风险提醒日历',
    description: 'A股、港股、美股关键交易风险事件合集',
    filter: () => true
  }
]

const DEFAULT_CALENDAR_NAME = CALENDARS[0].name;

const EVENT_TEMPLATES = {
  'us-fomc': {
    market: 'US',
    level: 'critical',
    category: 'Macro / Fed / FOMC',
    title: ({ label }) => `FOMC 利率决议：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数', '黄金'],
    sourceName: 'Federal Reserve',
    sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    marketExpectation: '市场通常会先交易政策路径和措辞变化。若表态偏鹰，长端利率与成长股估值承压；若偏鸽，纳指和高估值板块往往先反应。',
    historicalReaction: '近几个周期里，FOMC 对指数期货、美元和美债的冲击通常比单一经济数据更持久，会议声明后 15–60 分钟最容易放大波动。',
    actionPlan: '会前把高杠杆、方向性很强的仓位降到可承受区间；如果必须持仓，优先保留结构性对冲而不是裸多/裸空；发布后等第一次波动方向确认，再决定是否跟进。',
    reason: 'FOMC 利率决议会直接影响利率预期、美债收益率、美元指数和成长股估值。',
    checklist: ['是否有未保护仓位', '是否需要降低杠杆', '是否避免声明发布前追单', '止损是否过近']
  },
  'us-fomc-minutes': {
    market: 'US',
    level: 'high',
    category: 'Macro / Fed Minutes',
    title: ({ label }) => `FOMC 会议纪要发布：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数'],
    sourceName: 'Federal Reserve',
    sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    marketExpectation: '纪要的影响往往不如议息日尖锐，但它会重新定义市场对内部分歧、降息节奏和措辞细节的理解。',
    historicalReaction: '如果议息日后市场已经形成单边解读，纪要更容易把原来被忽略的分歧重新拿出来交易，尤其是利率敏感板块。',
    actionPlan: '不要提前赌纪要；先看议息后的定价有没有过度。如果市场已经单边反应，纪要更适合用来减仓或确认，而不是重新冒进。',
    reason: 'FOMC 纪要可能改变市场对未来利率路径和政策分歧的理解。',
    checklist: ['是否持有对利率敏感的高估值资产', '是否需要避开纪要发布前后加仓', '是否需要检查隔夜风险']
  },
  'us-nfp': {
    market: 'US',
    level: 'critical',
    category: 'Macro / Employment / NFP',
    title: ({ label }) => `非农就业：${label} Employment Situation`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数', '黄金'],
    sourceName: 'BLS',
    sourceUrl: 'https://www.bls.gov/schedule/news_release/empsit.htm',
    marketExpectation: '市场关注的不只是就业人数本身，而是失业率、薪资增速和前值修正。只要薪资和失业率组合偏热，利率预期就会迅速重定价。',
    historicalReaction: '非农通常是美股、美元和美债同步剧烈波动的高发时点，前 5 分钟常是假动作，真正方向往往在 10–30 分钟后才显现。',
    actionPlan: '指数或高贝塔科技股仓位拆成核心和战术两层，战术层在数据前尽量减掉；如果看多但不想赌数据，等第一波冲击后回踩确认再进。',
    reason: '非农就业和失业率会影响美联储政策预期、收益率曲线和风险资产定价。',
    checklist: ['是否有未保护仓位', '是否需要降低杠杆', '是否避免数据公布前追单', '止损是否过近']
  },
  'us-cpi': {
    market: 'US',
    level: 'critical',
    category: 'Macro / CPI',
    title: ({ label }) => `CPI 发布：${label}美国通胀数据`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数', '黄金'],
    sourceName: 'BLS',
    sourceUrl: 'https://www.bls.gov/schedule/news_release/cpi.htm',
    marketExpectation: 'CPI 交易的核心不是单月数字，而是核心通胀趋势是否继续黏性化。市场会先交易降息路径，再交易风险资产估值。',
    historicalReaction: 'CPI 经常触发“先剧烈反向、再延续”的走势，尤其在前期市场已经单边押注降息/不降息时，反应会更极端。',
    actionPlan: '没有明显优势时，不猜方向，先降低事件前暴露；如果必须参与，提前写好偏热和偏冷两套交易计划。',
    reason: 'CPI 会影响利率预期、美债收益率、美元指数和成长股估值。',
    checklist: ['是否有未保护仓位', '是否需要降低杠杆', '是否避免数据公布前追单', '止损是否过近']
  },
  'us-ppi': {
    market: 'US',
    level: 'high',
    category: 'Macro / PPI',
    title: ({ label }) => `PPI 发布：${label}生产者价格指数`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数'],
    sourceName: 'BLS',
    sourceUrl: 'https://www.bls.gov/schedule/news_release/ppi.htm',
    marketExpectation: 'PPI 不是终局，但经常是 CPI 预期的前置信号。若 PPI 先走强，市场会提前把通胀压力映射到下一轮 CPI。',
    historicalReaction: 'PPI 的冲击一般弱于 CPI，但在 CPI 前后发布时，它常常会影响隔夜定价和风险偏好。',
    actionPlan: '如果已经有方向性仓位，PPI 更适合做减噪而不是加码；除非做宏观策略，否则不要把它当成单独赌方向的理由。',
    reason: 'PPI 是通胀链条的重要输入，可能影响市场对后续 CPI、企业利润率和利率路径的预期。',
    checklist: ['数据公布前是否需要降低仓位', '是否避免在公布前追单', '高估值科技股仓位是否过重']
  },
  'us-vix': {
    market: 'US',
    level: 'high',
    category: 'Derivatives / VIX Options Expiration',
    title: ({ label }) => `VIX 期权到期日：${label}`,
    location: '美国',
    assets: ['VIX', 'SPX', 'SPY', 'QQQ', 'ES', 'NQ'],
    sourceName: 'Cboe',
    sourceUrl: 'https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf',
    marketExpectation: '波动率相关事件往往会把盘面从“看方向”切换成“看波动”。如果市场前期已经很平静，VIX 到期更容易把隐波结构拉开。',
    historicalReaction: '这类日子里，现货未必大跌大涨，但盘中来回和尾盘拉扯更明显；对短线和高频仓位比对中长线仓位更敏感。',
    actionPlan: '如果不是专门做波动率交易，降低短线追单频率，保留更宽的止损和更小的仓位；做对冲时提前检查对冲效率。',
    reason: 'VIX 期权到期可能影响波动率产品、对冲需求和指数短期波动结构。',
    checklist: ['是否有波动率相关仓位', '指数对冲是否需要调整', '是否避免在流动性变化窗口追单']
  },
  'us-index-last-trade': {
    market: 'US',
    level: 'high',
    category: 'Derivatives / Index Options Last Trading Day',
    title: ({ label }) => `指数期权 AM-settled 最后交易日提醒：${label}`,
    location: '美国',
    assets: ['SPX', 'SPY', 'QQQ', 'ES', 'NQ'],
    sourceName: 'Cboe',
    sourceUrl: 'https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf',
    marketExpectation: '到期前一交易日，流动性和对冲行为常会提前改变，盘尾更容易出现被动收口或异动。',
    historicalReaction: '这类事件对日内波动和盘尾影响更明显，若当天市场本来就有宏观催化，很容易叠加放大。',
    actionPlan: '短线不要在尾盘硬追；如果有相关仓位，提前一到两天处理最靠近到期的裸方向风险。',
    reason: '月度 AM-settled 指数期权通常在到期日前一交易日结束交易，可能影响指数对冲、流动性和尾盘波动。',
    checklist: ['是否有指数期权或相关 ETF 仓位', '是否需要避免尾盘流动性冲击', '是否确认隔夜结算风险']
  },
  'us-opex': {
    market: 'US',
    level: 'high',
    category: 'Derivatives / Monthly Options Expiration',
    title: ({ label }) => `月度期权到期日：OPEX 风险窗口（${label}）`,
    location: '美国',
    assets: ['SPX', 'SPY', 'QQQ', 'ES', 'NQ'],
    sourceName: 'Cboe',
    sourceUrl: 'https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf',
    marketExpectation: 'OPEX 常常带来的是“盘面被对冲机制牵着走”，而不是纯粹的基本面交易。',
    historicalReaction: '在 OPEX 附近，最容易看到的是指数尾盘拉扯、窄幅震荡后突然走单边，尤其在大资金集中平仓时。',
    actionPlan: '趋势交易更适合观察而不是加码；短线交易应缩小仓位、放大容错，等方向被确认后再出手。',
    reason: '月度期权到期可能改变做市商对冲、指数流动性和盘中波动。',
    checklist: ['是否有短期期权或指数 ETF 仓位', '是否需要避免尾盘追单', '是否需要减少隔夜暴露']
  },
  'cn-cffex': {
    market: 'CN',
    level: 'high',
    category: 'Derivatives / CFFEX Monthly Expiry',
    title: ({ label }) => `股指期货/期权月度交割日提醒：${label}`,
    location: '中国',
    assets: ['沪深300', '中证500', '中证1000', '上证50', 'A股指数期货/期权'],
    sourceName: '中国金融期货交易所',
    sourceUrl: 'http://www.cffex.com.cn/',
    marketExpectation: 'A股交割日更容易让尾盘资金行为集中，指数和高权重板块容易被动放大波动。',
    historicalReaction: '交割日的主要影响不是单独创造趋势，而是把指数权重、期现对冲和尾盘流动性集中到同一个窗口里。',
    actionPlan: '交割日前一日开始，把指数 ETF、股指期货、融资或高贝塔仓位降到不会被尾盘波动打乱的水平；当天 14:30 后不追涨杀跌。',
    reason: 'A股股指期货、期权月度交割日前后，指数成分、对冲需求和尾盘流动性可能变化。',
    checklist: ['是否持有指数 ETF 或股指期货相关仓位', '是否需要关注尾盘波动', '是否避免临近交割日过度加杠杆']
  },
  'cn-penultimate-bizday': {
    market: 'CN',
    level: 'high',
    category: 'Calendar / China Month-End Business Day',
    title: ({ label }) => `每月倒数第二个中国营业日：${label}`,
    location: '中国',
    assets: ['A股交易日历', '月末调仓', '资金安排'],
    sourceName: '中国交易日历',
    sourceUrl: 'https://www.sse.com.cn/',
    marketExpectation: '月末倒数第二个中国营业日通常会让调仓、结算、交割和资金安排更集中。',
    historicalReaction: '越接近月末，量化调仓、绩效窗口和资金安排越容易把波动压缩到最后几个交易时段。',
    actionPlan: '月末前把该处理的仓位、计划和资金安排提前做完，不要把操作拖到最后一个交易日。',
    reason: '月末倒数第二个中国营业日常常是很多交易和运营动作的提前收口窗口。',
    checklist: ['是否需要提前做月末调仓', '是否有资金或结算安排', '是否要避开尾盘临时决策']
  },
  'cn-a50-last-trade': {
    market: 'CN',
    level: 'high',
    category: 'Derivatives / SGX A50 Futures Last Trading Day',
    title: ({ label }) => `A50 期货最后交易日：${label}`,
    location: '中国',
    assets: ['A50期货', 'A股指数期货/相关对冲'],
    sourceName: 'SGX',
    sourceUrl: 'https://www.kgieworld.sg/futures/sgx-FTSE-China-A50-index-futures-contract-specifications',
    marketExpectation: 'A50 临近最后交易日时，期现和对冲行为通常会收敛，尾盘更容易受到平仓和移仓影响。',
    historicalReaction: '这类日子主要影响的是期货移仓、对冲和尾盘流动性，真正放大的往往是最后一两个交易时段。',
    actionPlan: '临近到期前把裸方向仓位降下来，尽量提前处理需要移仓的合约，不要把最紧的风险留到尾盘。',
    reason: 'A50 期货最后交易日通常是合约月的倒数第二个中国营业日，可能影响移仓和平仓节奏。',
    checklist: ['是否持有 A50 期货相关仓位', '是否需要提前移仓', '是否避免最后交易日前后追单']
  },
  'cn-earnings': {
    market: 'CN',
    level: 'high',
    category: 'Earnings / Disclosure Deadline',
    title: ({ label }) => `A股${label}：业绩与公告风险`,
    location: '中国',
    assets: ['A股上市公司', '沪深300', '中证500', '中证1000', '创业板'],
    sourceName: '中国证监会 / 沪深交易所信息披露规则',
    sourceUrl: 'https://www.csrc.gov.cn/',
    marketExpectation: '定期报告截止窗口里，市场通常先交易“预期差”而不是绝对数。高估值、低预期、盈利修复不稳的票最容易被放大。',
    historicalReaction: 'A股财报截止期附近，盘面经常从指数行情切回个股分化，业绩不及预期的票容易出现连续反馈。',
    actionPlan: '提前识别持仓是否有披露风险；如果拿的是行业 ETF，就检查成分股里是否有高权重公司在窗口期内可能踩雷。',
    reason: '定期报告披露截止窗口会集中释放业绩不及预期、减值、风险提示、监管问询等信息。',
    checklist: ['持仓公司是否尚未披露定期报告', '是否有业绩预告与实际报告偏差风险', '是否需要避开财报前后追涨杀跌']
  },
  'hk-index-expiry': {
    market: 'HK',
    level: 'high',
    category: 'Derivatives / HKEX Monthly Expiry',
    title: ({ label }) => `港股指数期货/期权月度到期提醒：${label}`,
    location: '香港',
    assets: ['HSI', 'HSCEI', 'HSTECH', '港股指数期货/期权'],
    sourceName: 'HKEX',
    sourceUrl: 'https://www.hkex.com.hk/Products/Listed-Derivatives/Equity-Index/Hang-Seng-Index-Futures-and-Options',
    marketExpectation: '港股到期日常常把外盘情绪和本地流动性叠加在一起，尾盘容易出现放大。',
    historicalReaction: '恒指、恒科在衍生品到期附近经常会更受大盘对冲流影响，走势不完全按单一成分股逻辑走。',
    actionPlan: '做港股指数或科技权重时，重仓和追价动作避开到期日尾盘；做单票时，注意指数噪音不要误判成个股基本面。',
    reason: '港股指数期货/期权月度到期可能影响恒指、国企指数和恒生科技指数的对冲流与尾盘波动。',
    checklist: ['是否持有港股指数 ETF 或衍生品仓位', '是否需要关注尾盘流动性', '是否需要提前调整隔夜风险']
  }
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function withChinaTimezone(date, time) {
  return `${date}T${time}:00+08:00`;
}

function eventFromFixedSpec(spec) {
  const template = EVENT_TEMPLATES[spec.kind];
  if (!template) throw new Error(`Unknown fixed event kind: ${spec.kind}`);

  const { kind, date, startTime, endTime, label, ...overrides } = spec;

  return {
    ...template,
    ...overrides,
    title: template.title({ ...spec, label }),
    start: withChinaTimezone(date, startTime),
    end: withChinaTimezone(date, endTime),
    timezone: 'Asia/Shanghai',
    timeStatus: spec.timeStatus || template.timeStatus || 'confirmed',
    levelLabel: LEVEL_META[template.level].label
  };
}

function readFixedEvents() {
  const fixed = readJson(fixedEventsPath, { events: [] });
  return fixed.events.map(eventFromFixedSpec);
}

function dedupeEvents(events) {
  const byKey = new Map();
  for (const event of events) {
    const key = [event.market, event.category, event.start].join('|');
    byKey.set(key, event);
  }
  return Array.from(byKey.values());
}

function readEvents() {
  const events = dedupeEvents([...readJson(dataPath, []), ...readFixedEvents(), ...readJson(usMegacapEarningsPath, [])]);
  return events
    .filter((event) => LEVEL_META[event.level])
    .sort((a, b) => a.start.localeCompare(b.start) || a.market.localeCompare(b.market));
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n');
}

function formatDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Invalid datetime: ${value}`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
}

function stableTimestamp(event) {
  return `${event.start.slice(0, 10).replaceAll('-', '')}T000000Z`;
}

function stableUid(event) {
  const seed = [event.market, event.category, event.sourceName, event.title, event.start.slice(0, 10)].join('|');
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10);
  return `risk-${event.market}-${event.start.slice(0, 10)}-${digest}@financial-calendar`;
}

function marketTag(market) {
  return {
    US: '美股',
    CN: 'A股',
    HK: '港股'
  }[market] || market;
}

function eventEmoji(event, meta) {
  if (event.category === 'Earnings / US Megacap') return '📊';
  return meta.emoji;
}

function summary(event) {
  const meta = LEVEL_META[event.level];
  return `${eventEmoji(event, meta)} [${marketTag(event.market)}] ${event.title}`;
}

function eventDateTimeLabel(event) {
  const match = String(event.start).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return event.start;
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} 北京时间`;
}

function marketLabel(market) {
  return {
    US: '美股',
    CN: 'A股/中国市场',
    HK: '港股'
  }[market] || market;
}

function categoryLabel(category) {
  return {
    'Earnings / US Megacap': '美股前 20 大公司财报',
    'Macro / Fed / FOMC': '美联储议息会议',
    'Macro / Fed Minutes': '美联储会议纪要',
    'Macro / Employment / NFP': '美国非农就业数据',
    'Macro / CPI': '美国消费者价格指数',
    'Macro / PPI': '美国生产者价格指数',
    'Derivatives / VIX Options Expiration': 'VIX 期权到期',
    'Derivatives / Index Options Last Trading Day': '美股指数期权最后交易日',
    'Derivatives / Monthly Options Expiration': '美股月度期权到期',
    'Derivatives / CFFEX Monthly Expiry': 'A股股指期货/期权月度交割',
    'Calendar / China Month-End Business Day': '中国月末倒数第二个营业日',
    'Derivatives / SGX A50 Futures Last Trading Day': 'A50 期货最后交易日',
    'Earnings / Disclosure Deadline': 'A股定期报告披露截止窗口',
    'Derivatives / HKEX Monthly Expiry': '港股指数期货/期权月度到期'
  }[category] || category;
}

function timeStatusLabel(status) {
  return {
    confirmed: '已确认',
    estimated: '预估',
    'rule-based': '规则推算'
  }[status] || status;
}

function timingLabel(event) {
  const hour = Number(String(event.start).slice(11, 13));
  if (event.timeStatus === 'estimated') return '时间状态为预估，适合先做风险准备，临近日期需要复核。';
  if (event.category === 'Earnings / US Megacap' && hour < 8) return '美股盘后财报，主要反应会先体现在盘后个股、纳指期货和第二天常规交易。';
  if (event.category === 'Earnings / US Megacap' && hour >= 19 && hour <= 21) return '美股盘前财报，常规开盘前会完成第一轮定价，开盘后容易出现二次确认或反向修正。';
  return `时间状态为${timeStatusLabel(event.timeStatus)}。`;
}

function extractEarningsContext(event) {
  const eps = event.consensusEps || event.marketExpectation?.match(/共识(?:每股收益| EPS)为 ([^，。]+)/)?.[1];
  const estimates = event.marketExpectation?.match(/覆盖分析师数量为 ([^，。]+)/)?.[1];
  return { eps: eps || '未提供', estimates: event.analystCount || estimates || '未提供' };
}

function buildEarningsDescription(event, meta) {
  const { eps, estimates } = extractEarningsContext(event);
  const mainTicker = event.ticker || event.assets[0];
  const companyLabel = event.companyChineseName && event.companyEnglishName
    ? `${event.companyChineseName}（${event.companyEnglishName}，${mainTicker}）`
    : mainTicker;
  const relatedAssets = event.assets.slice(1).join('、');

  return [
    `日历名称：${DEFAULT_CALENDAR_NAME}`,
    `事件标题：${summary(event)}`,
    `事件时间：${eventDateTimeLabel(event)}`,
    `风险等级：${event.levelLabel || meta.label}`,
    `市场：${marketLabel(event.market)}`,
    `事件类型：美股前 20 大公司财报（仅滚动保留未来 30 天内数据）`,
    `时间可信度：${timeStatusLabel(event.timeStatus)}`,
    `数据来源：${event.sourceName}`,
    `来源链接：${event.sourceUrl}`,
    '',
    '当前真实数据：',
    `- 标的：${companyLabel}`,
    `- 财报季度：${event.fiscalQuarter || event.title.split('：').at(-1)}`,
    `- 纳斯达克共识每股收益：${eps}`,
    `- 覆盖分析师数量：${estimates}`,
    `- 财报发布时间特征：${timingLabel(event)}`,
    '',
    '影响范围：',
    `- 直接影响：${companyLabel} 本身的盘前/盘后跳空、期权隐含波动率和成交量。`,
    `- 指数影响：${relatedAssets || '相关指数与 ETF'}，尤其是财报后第一个常规交易时段。`,
    '- 产业链影响：如果指引明显偏离预期，会外溢到同赛道公司、供应链、客户和竞争对手。',
    '- 情绪影响：超大市值公司财报容易改变市场对成长、消费、防御或周期板块的风险偏好。',
    '',
    '操作建议：',
    '- 财报前：不要在事件前临时加重仓；已有仓位先确认最大可承受跳空，不符合就提前降仓。',
    '- 财报发布时：先看营收、利润率、每股收益、下季度/全年指引和管理层措辞，不只看表面每股收益是否高于预期。',
    '- 财报后：如果盘后/盘前大幅跳动，等常规交易前 15–30 分钟成交和期货反应稳定后再判断；不要用第一根波动直接追。',
    '- 组合层面：如果同时持有 QQQ/SPY 或同赛道股票，把它当成组合风险事件处理，而不是单一个股新闻。',
    '',
    '检查清单：',
    ...event.checklist.map((item) => `- ${item}`)
  ].join('\n');
}

function buildDescription(event) {
  const meta = LEVEL_META[event.level];
  if (event.category === 'Earnings / US Megacap') return buildEarningsDescription(event, meta);

  return [
    `日历名称：${DEFAULT_CALENDAR_NAME}`,
    `事件标题：${summary(event)}`,
    `事件时间：${eventDateTimeLabel(event)}`,
    `风险等级：${event.levelLabel || meta.label}`,
    `市场：${marketLabel(event.market)}`,
    `事件类型：${categoryLabel(event.category)}`,
    `影响资产：${event.assets.join('、')}`,
    `时间状态：${timeStatusLabel(event.timeStatus)}`,
    `来源：${event.sourceName}`,
    `来源链接：${event.sourceUrl}`,
    '',
    '当前真实数据与市场含义：',
    `- ${event.marketExpectation}`,
    `- ${event.reason}`,
    '',
    '影响范围：',
    `- 主要影响资产：${event.assets.join('、')}`,
    `- 市场层级：${marketLabel(event.market)}，并可能通过相关 ETF、指数期货、期权和跨市场情绪外溢。`,
    `- 历史反应：${event.historicalReaction}`,
    '',
    '操作建议：',
    `- ${event.actionPlan}`,
    '- 事件前先处理仓位和止损，不把方向判断留到波动最大的时段。',
    '- 事件后等第一轮价格反应、成交量和相关资产联动确认，再决定是否跟进。',
    '',
    '检查清单：',
    ...event.checklist.map((item) => `- ${item}`)
  ].join('\n');
}

function renderAlarm(event, trigger) {
  return [
    'BEGIN:VALARM',
    `TRIGGER;RELATED=START:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary(event))}`,
    'END:VALARM'
  ].join('\r\n');
}

function renderEvent(event) {
  const meta = LEVEL_META[event.level];
  return [
    'BEGIN:VEVENT',
    `UID:${stableUid(event)}`,
    `DTSTAMP:${stableTimestamp(event)}`,
    `DTSTART;TZID=${event.timezone}:${formatDateTime(event.start)}`,
    `DTEND;TZID=${event.timezone}:${formatDateTime(event.end || event.start)}`,
    `LOCATION:${escapeText(event.location)}`,
    `SUMMARY:${escapeText(summary(event))}`,
    `DESCRIPTION:${escapeText(buildDescription(event))}`,
    'CATEGORIES:交易风险',
    'TRANSP:TRANSPARENT',
    `X-RISK-LEVEL:${event.levelLabel || meta.label}`,
    `X-SOURCE-URL:${escapeText(event.sourceUrl)}`,
    ...meta.alarmTriggers.map((trigger) => renderAlarm(event, trigger)),
    'END:VEVENT'
  ].join('\r\n');
}

function renderCalendar(calendar, events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AWEN Financial Calendar//阿文风险提醒日历//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-CALDESC:${escapeText(calendar.description)}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events.map(renderEvent),
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

function main() {
  const events = readEvents();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(path.join(outputDir, 'CN_HIGH.ics'), { force: true });
  fs.rmSync(path.join(outputDir, 'HK_HIGH.ics'), { force: true });
  fs.rmSync(path.join(outputDir, 'US_HIGH.ics'), { force: true });

  for (const calendar of CALENDARS) {
    const selected = events.filter(calendar.filter);
    const output = renderCalendar(calendar, selected);
    const outputPath = path.join(outputDir, calendar.file);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`${calendar.file}: ${selected.length} events`);
  }
}

main();
