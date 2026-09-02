import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCffexMarketImpact } from './cffex-market-impact.mjs';
import { WATCHLIST as US_EARNINGS_WATCHLIST } from './update-us-megacap-earnings.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const dataPath = path.join(rootDir, 'data/risk-events.json');
const fixedEventsPath = path.join(rootDir, 'data/fixed-events-2026.json');
const usMegacapEarningsPath = path.join(rootDir, 'data/us-megacap-earnings.json');
const cffexPositionWatchPath = path.join(rootDir, 'data/cffex-position-watch.json');
const outputDir = path.join(rootDir, 'public/calendar');

const LEVEL_META = {
  critical: {
    emoji: '🔴',
    label: '极高',
    alarmTriggers: ['-PT10M']
  },
  high: {
    emoji: '🟠',
    label: '高',
    alarmTriggers: ['-PT10M']
  }
};

const CALENDAR_DISPLAY_START_TIME = '08:00';
const CALENDAR_DISPLAY_END_TIME = '09:00';
const US_EARNINGS_WATCHLIST_SIZE = US_EARNINGS_WATCHLIST.length;
const REAL_TIME_DISPLAY_CATEGORIES = new Set([
  'Derivatives / CFFEX Position Watch',
  'Derivatives / CFFEX Follow-up Review',
  'Macro / Employment / ADP',
  'Macro / Employment / Initial Claims',
  'Macro / Employment / JOLTS',
  'Macro / PCE',
  'Macro / Consumption / Retail Sales',
  'Macro / PMI / ISM Manufacturing',
  'Macro / PMI / ISM Services',
  'Macro / Growth / GDP',
  'Macro / Sentiment / Michigan',
  'Macro / PMI / S&P Global Flash'
]);

const CALENDARS = [
  {
    file: 'GLOBAL_KEY.ics',
    name: '阿文风险提醒日历',
    description: 'A股、港股、美股关键交易风险事件合集',
    filter: () => true
  }
]

const DEFAULT_CALENDAR_NAME = CALENDARS[0].name;
export const SUBSCRIBED_EARNINGS_SYMBOLS = new Set(US_EARNINGS_WATCHLIST.map((company) => company.symbol));

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
  'us-adp': {
    market: 'US',
    level: 'high',
    category: 'Macro / Employment / ADP',
    title: ({ label }) => `ADP 小非农：${label}私营就业报告`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数', '黄金'],
    sourceName: 'ADP Research',
    sourceUrl: 'https://adpemploymentreport.com/',
    marketExpectation: 'ADP 会提前改变市场对正式非农的预期。若明显强于预期，市场容易提前交易就业偏热和降息延后；若明显弱于预期，市场会先交易就业降温。',
    historicalReaction: 'ADP 与正式非农并不总是一致，因此冲击通常弱于 NFP，但在非农前两天仍容易放大美元、美债和股指期货波动。',
    actionPlan: '把它当作非农前哨而不是最终答案；数据公布前避免重仓赌正式非农方向，公布后重点看市场是否把 NFP 预期重新定价。',
    reason: 'ADP 小非农会影响市场对美国就业强弱、非农预期和美联储政策路径的提前定价。',
    checklist: ['是否把 ADP 当成非农前哨而非最终结论', '是否需要降低高贝塔仓位', '是否避免数据前追单']
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
  'us-pce': {
    market: 'US',
    level: 'critical',
    category: 'Macro / PCE',
    title: ({ label }) => `PCE 发布：${label}个人消费支出物价`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数', '黄金'],
    sourceName: 'BEA',
    sourceUrl: 'https://www.bea.gov/news/schedule',
    marketExpectation: 'PCE 尤其是核心 PCE 是美联储更偏好的通胀指标。高于预期会压低降息概率，低于预期会强化通胀回落叙事。',
    historicalReaction: 'PCE 通常不如 CPI 瞬时剧烈，但在利率路径分歧较大时，会明显影响美债收益率、美元和成长股估值。',
    actionPlan: '不要只看总 PCE，要同步看核心 PCE、个人收入和支出；事件前把高估值成长和长久期资产风险降到可承受范围。',
    reason: 'PCE 是美联储重点关注的通胀指标，会影响政策路径、实际利率和风险资产估值。',
    checklist: ['是否关注核心 PCE', '是否检查美债收益率方向', '是否避免数据前加杠杆']
  },
  'us-initial-claims': {
    market: 'US',
    level: 'high',
    category: 'Macro / Employment / Initial Claims',
    title: ({ label }) => `初请失业金人数：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数'],
    sourceName: 'U.S. Department of Labor',
    sourceUrl: 'https://www.dol.gov/ui/data.pdf',
    marketExpectation: '初请是高频就业温度计。连续上升会强化就业降温和降息预期；持续低位则说明劳动力市场仍紧。',
    historicalReaction: '单周噪音较大，但如果与非农、JOLTS、ADP 同向，会放大市场对就业拐点的交易。',
    actionPlan: '不要孤立看单周数字，重点看四周均值和是否连续偏离预期；数据前后控制短线仓位。',
    reason: '初请失业金人数能更高频地反映就业市场是否恶化，从而影响美联储政策预期。',
    checklist: ['是否看四周均值', '是否与非农/ADP/JOLTS 交叉验证', '是否避免单周噪音过度交易']
  },
  'us-jolts': {
    market: 'US',
    level: 'high',
    category: 'Macro / Employment / JOLTS',
    title: ({ label }) => `JOLTS 职位空缺：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'ES', 'NQ', '美债', '美元指数'],
    sourceName: 'BLS',
    sourceUrl: 'https://www.bls.gov/schedule/news_release/jolts.htm',
    marketExpectation: '职位空缺高说明劳动力需求强，工资和服务通胀压力可能更黏；职位空缺下降则支持就业降温叙事。',
    historicalReaction: 'JOLTS 对盘中的冲击通常低于非农，但在美联储强调劳动力供需时会显著影响利率预期。',
    actionPlan: '重点看职位空缺、离职率和招聘率是否同向；如果数据与非农背离，不要只凭单个指标下结论。',
    reason: 'JOLTS 能反映劳动力市场供需和工资压力，是美联储观察就业再平衡的重要数据。',
    checklist: ['职位空缺是否继续下降', '离职率是否变化', '是否与非农和初请交叉验证']
  },
  'us-retail-sales': {
    market: 'US',
    level: 'high',
    category: 'Macro / Consumption / Retail Sales',
    title: ({ label }) => `零售销售：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'XLY', '美债', '美元指数'],
    sourceName: 'U.S. Census Bureau',
    sourceUrl: 'https://www.census.gov/economic-indicators/calendar-listview.html',
    marketExpectation: '零售销售强说明消费韧性仍在，可能推迟降息；零售走弱则提示增长压力和企业收入预期下修。',
    historicalReaction: '消费数据会同时影响经济增长和利率预期，市场反应取决于当时更担心通胀还是衰退。',
    actionPlan: '同步看核心零售和控制组，不只看总数；消费股、纳指和美债仓位在公布前避免过度集中。',
    reason: '美国消费是经济增长核心，零售销售会影响 GDP、企业盈利和政策预期。',
    checklist: ['是否看核心零售/控制组', '是否关注消费股暴露', '是否判断市场当前担心通胀还是衰退']
  },
  'us-ism-manufacturing': {
    market: 'US',
    level: 'high',
    category: 'Macro / PMI / ISM Manufacturing',
    title: ({ label }) => `ISM 制造业 PMI：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'DIA', '工业品', '美债', '美元指数'],
    sourceName: 'ISM',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/',
    marketExpectation: '制造业 PMI 高于 50 表示扩张，低于 50 表示收缩；新订单、就业和价格分项会决定市场交易增长还是通胀。',
    historicalReaction: 'ISM 制造业对周期股、工业品和美债较敏感，若与其他数据共同指向衰退或再通胀，影响会放大。',
    actionPlan: '重点看新订单和价格分项；不要只看 headline 数字，尤其在 50 附近容易误判。',
    reason: 'ISM 制造业 PMI 是美国景气度和企业订单的领先指标。',
    checklist: ['新订单是否改善', '价格分项是否再升温', '是否处于 50 荣枯线附近']
  },
  'us-ism-services': {
    market: 'US',
    level: 'high',
    category: 'Macro / PMI / ISM Services',
    title: ({ label }) => `ISM 服务业 PMI：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', '服务消费', '美债', '美元指数'],
    sourceName: 'ISM',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/',
    marketExpectation: '服务业占美国经济权重更大。服务业强且价格分项高，会强化通胀黏性；服务业弱则加大增长担忧。',
    historicalReaction: '服务业 PMI 在通胀黏性阶段常比制造业更能影响降息预期，尤其是价格和就业分项。',
    actionPlan: '重点看商业活动、就业和价格分项；若价格强而增长弱，要警惕滞胀式定价。',
    reason: 'ISM 服务业 PMI 能反映美国服务消费、就业和服务通胀压力。',
    checklist: ['价格分项是否偏热', '就业分项是否转弱', '是否出现增长弱但价格强']
  },
  'us-gdp': {
    market: 'US',
    level: 'high',
    category: 'Macro / Growth / GDP',
    title: ({ label }) => `GDP 发布：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'DIA', '美债', '美元指数'],
    sourceName: 'BEA',
    sourceUrl: 'https://www.bea.gov/news/schedule',
    marketExpectation: 'GDP 强说明经济韧性和盈利基础仍在，但也可能推迟降息；GDP 弱会提高降息预期，同时带来衰退担忧。',
    historicalReaction: 'GDP 对市场方向的影响取决于主线矛盾：通胀阶段强 GDP 偏利空估值，衰退阶段弱 GDP 偏利空盈利。',
    actionPlan: '先判断市场当前交易的是通胀、降息还是衰退；重点看实际 GDP、消费和价格分项。',
    reason: 'GDP 是经济增长总量指标，会影响企业盈利、利率路径和风险偏好。',
    checklist: ['市场当前主线是通胀还是衰退', '消费分项是否强', '价格分项是否偏热']
  },
  'us-michigan': {
    market: 'US',
    level: 'high',
    category: 'Macro / Sentiment / Michigan',
    title: ({ label }) => `密歇根消费者信心与通胀预期：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'XLY', '美债', '美元指数'],
    sourceName: 'University of Michigan Surveys of Consumers',
    sourceUrl: 'https://www.sca.isr.umich.edu/',
    marketExpectation: '消费者信心影响消费预期，通胀预期影响美联储对通胀锚定的判断。长期通胀预期上升尤其容易触发鹰派定价。',
    historicalReaction: '密歇根数据本身冲击中等，但通胀预期意外上行时，美债收益率和成长股估值反应会更明显。',
    actionPlan: '重点看一年期和五到十年通胀预期，不要只看信心指数；若通胀预期上行，控制长久期资产暴露。',
    reason: '密歇根通胀预期会影响市场对通胀锚定和美联储政策耐心的判断。',
    checklist: ['一年期通胀预期是否上行', '长期通胀预期是否脱锚', '是否与实际通胀数据背离']
  },
  'us-sp-global-pmi-flash': {
    market: 'US',
    level: 'high',
    category: 'Macro / PMI / S&P Global Flash',
    title: ({ label }) => `标普全球 PMI 初值：${label}`,
    location: '美国',
    assets: ['SPY', 'QQQ', 'DIA', '美债', '美元指数'],
    sourceName: 'S&P Global',
    sourceUrl: 'https://www.spglobal.com/marketintelligence/en/mi/products/pmi.html',
    marketExpectation: 'PMI 初值比很多硬数据更早，能提前改变市场对增长、订单和价格压力的判断。',
    historicalReaction: '单次冲击通常低于 CPI/非农，但如果与 ISM、零售、就业数据同向，会强化经济拐点交易。',
    actionPlan: '把它当领先信号；重点看制造业、服务业和综合 PMI 是否同向，而不是只看单个分项。',
    reason: '标普全球 PMI 初值能提前反映企业景气度、需求和价格压力。',
    checklist: ['制造业和服务业是否同向', '价格分项是否偏热', '是否与 ISM 后续数据一致']
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

function dedupeKey(event) {
  if (event.category === 'Earnings / US Megacap') {
    return [event.market, event.category, event.ticker || event.assets?.[0] || event.title, event.fiscalQuarter || event.start].join('|');
  }

  return [event.market, event.category, event.start].join('|');
}

function earningsRecordPreferenceScore(event) {
  const time = event?.nasdaqCalendarFields?.time;
  const timeStatus = event?.timeStatus;
  return [
    timeStatus === 'confirmed' ? 100 : 0,
    time && time !== 'time-not-supplied' ? 50 : 0,
    time === 'time-after-hours' || time === 'time-pre-market' ? 20 : 0,
    event?.reportedFinancials && event?.stageBAnalysis ? 10 : 0,
    event?.reportedFinancials?.sourceUrl ? 5 : 0
  ].reduce((total, score) => total + score, 0);
}

function preferDedupeEvent(current, candidate) {
  if (!current) return candidate;
  if (candidate.category !== 'Earnings / US Megacap') return candidate;

  const currentScore = earningsRecordPreferenceScore(current);
  const candidateScore = earningsRecordPreferenceScore(candidate);
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current;

  return String(candidate.start || '').localeCompare(String(current.start || '')) > 0 ? candidate : current;
}

function dedupeEvents(events) {
  const byKey = new Map();
  for (const event of events) {
    const key = dedupeKey(event);
    byKey.set(key, preferDedupeEvent(byKey.get(key), event));
  }
  return Array.from(byKey.values());
}

function readEvents() {
  const events = dedupeEvents([
    ...readJson(dataPath, []),
    ...readFixedEvents(),
    ...readJson(usMegacapEarningsPath, []),
    ...readJson(cffexPositionWatchPath, [])
  ]);
  return events
    .filter((event) => LEVEL_META[event.level])
    .filter((event) => event.category !== 'Earnings / US Megacap' || SUBSCRIBED_EARNINGS_SYMBOLS.has(event.ticker || event.assets?.[0]))
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
  if (event.category === 'Derivatives / CFFEX Follow-up Review') return '🧪';
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

function eventDisplayDateTime(event, time) {
  if (REAL_TIME_DISPLAY_CATEGORIES.has(event.category)) {
    return time === CALENDAR_DISPLAY_START_TIME ? event.start : event.end;
  }

  const date = String(event.start).slice(0, 10);
  return `${date}T${time}:00+08:00`;
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
    'Earnings / US Megacap': `${US_EARNINGS_WATCHLIST_SIZE} 个重点美股标的财报`,
    'Macro / Fed / FOMC': '美联储议息会议',
    'Macro / Fed Minutes': '美联储会议纪要',
    'Macro / Employment / NFP': '美国非农就业数据',
    'Macro / Employment / ADP': 'ADP 小非农',
    'Macro / Employment / Initial Claims': '美国初请失业金人数',
    'Macro / Employment / JOLTS': '美国 JOLTS 职位空缺',
    'Macro / CPI': '美国消费者价格指数',
    'Macro / PPI': '美国生产者价格指数',
    'Macro / PCE': '美国 PCE 通胀数据',
    'Macro / Consumption / Retail Sales': '美国零售销售',
    'Macro / PMI / ISM Manufacturing': '美国 ISM 制造业 PMI',
    'Macro / PMI / ISM Services': '美国 ISM 服务业 PMI',
    'Macro / Growth / GDP': '美国 GDP',
    'Macro / Sentiment / Michigan': '密歇根消费者信心与通胀预期',
    'Macro / PMI / S&P Global Flash': '标普全球 PMI 初值',
    'Derivatives / VIX Options Expiration': 'VIX 期权到期',
    'Derivatives / Index Options Last Trading Day': '美股指数期权最后交易日',
    'Derivatives / Monthly Options Expiration': '美股月度期权到期',
    'Derivatives / CFFEX Monthly Expiry': 'A股股指期货/期权月度交割',
    'Derivatives / CFFEX Position Watch': '中金所股指期货成交持仓排名跟踪',
    'Derivatives / CFFEX Follow-up Review': '中金所次日收盘复盘',
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

function valueOrMissing(value) {
  return value || '未提供';
}

function buildNasdaqFieldLines(event) {
  const fields = event.nasdaqCalendarFields || {};
  return [
    `- 公布时段：${valueOrMissing(fields.timeLabel)}（原始字段 time：${valueOrMissing(fields.time)}）`,
    `- 股票代码：${valueOrMissing(fields.symbol)}`,
    `- Nasdaq 公司名称：${valueOrMissing(fields.companyName)}`,
    `- 市值：${valueOrMissing(fields.marketCap)}`,
    `- 财报周期：${valueOrMissing(fields.fiscalQuarterEndingLabel)}（原始字段 fiscalQuarterEnding：${valueOrMissing(fields.fiscalQuarterEnding)}）`,
    `- 共识每股收益预测：${valueOrMissing(fields.epsForecast)}`,
    `- 覆盖分析师数量：${valueOrMissing(fields.noOfEsts)}`,
    `- 去年同期发布日期：${valueOrMissing(fields.lastYearRptDt)}`,
    `- 去年同期每股收益：${valueOrMissing(fields.lastYearEPS)}`
  ];
}

function buildStageAAnalysis(event, companyLabel, relatedAssets, eps, estimates) {
  const fields = event.nasdaqCalendarFields || {};
  return [
    '📊 阶段A：财报发布前预判',
    `- 🏷️ 标的与周期：${companyLabel}，财报周期为${event.fiscalQuarter || valueOrMissing(fields.fiscalQuarterEndingLabel)}。`,
    `- 🎯 市场一致预期：当前纳斯达克共识每股收益为 ${eps}，覆盖分析师数量为 ${estimates}。这是本次预判的公开基准。`,
    `- 🌐 行业与影响范围：直接影响 ${companyLabel}，并通过 ${relatedAssets || '相关指数与 ETF'} 传导到指数权重、同赛道公司、供应链和市场风险偏好。`,
    '- 💹 股价预期判断：当前日历没有接入财报前股价涨跌幅、估值分位、期权隐含波动率和卖方预期变化，因此不能断言市场已经计入多少好消息或坏消息。',
    '- 🧪 三套判定标准：',
    `  - ✅ 大幅超预期：实际每股收益明显高于 ${eps}，同时收入、利润率和下一期指引同步改善。`,
    `  - 🟢 符合预期：实际每股收益接近 ${eps}，收入和指引没有明显反向变化。`,
    `  - ❌ 不及预期：实际每股收益低于 ${eps}，或即使每股收益达标但收入、利润率、现金流或指引转弱。`,
    '- 🔍 本次重点观察指标：收入增速、毛利率/营业利润率、每股收益、自由现金流、库存或订单趋势、管理层对下一季度和全年指引的措辞。',
    '- ✨ 潜在催化：业绩高于共识、指引上调、利润率改善、回购或分红强化、核心业务增速重新加速。',
    '- ⚠️ 主要风险：收入低于预期、利润率下滑、现金流质量转弱、指引保守、管理层对需求或成本表达谨慎。',
    '- 🧭 操作建议：财报前不追高加仓；已有仓位先按最大跳空风险做压力测试。若组合里已有 QQQ/SPY 或同赛道股票，需要把这次财报当作组合风险事件处理。'
  ];
}

function bulletLines(items) {
  return (items || []).map((item) => `  - ${item}`);
}

function expectationVerdictIcon(verdict = '') {
  const text = String(verdict);
  if (/不及|低于|不符合|未达|下修|转弱/.test(text)) return '❌';
  if (/符合|高于|超预期|优于|略高|大幅超/.test(text)) return '✅';
  return '⚠️';
}

function buildStageBAnalysis(event, companyLabel) {
  const actual = event.reportedFinancials;
  const analysis = event.stageBAnalysis;

  if (actual && analysis) {
    const expectation = analysis.expectationSummary;
    const verdict = expectation?.verdict || analysis.expectationGapConclusion;
    const verdictIcon = expectationVerdictIcon(verdict);
    return [
      '📊 阶段B：财报发布后复盘结果',
      '',
      '🎯 总判断：',
      `- 是否符合预期：${verdictIcon} ${verdict}`,
      `- 核心对比指标：${expectation?.metric || '每股收益'}`,
      `- 市场预期：${expectation?.marketExpectation || '未提供'}`,
      `- 实际结果：${expectation?.actualResult || '未提供'}`,
      `- 预期差：${expectation?.absoluteDifference || '未提供'}（${expectation?.percentageDifference || '未提供'}）`,
      `- 调整后结果：${expectation?.adjustedActualResult || '未提供'}`,
      `- 调整后预期差：${expectation?.adjustedDifference || '未提供'}`,
      `- 调整说明：${expectation?.adjustmentNote || '无额外调整说明'}`,
      '',
      `- 数据来源：${actual.sourceName}`,
      `- 来源链接：${actual.sourceUrl}`,
      `- 财报期结束日：${actual.periodEnded}`,
      '',
      '📌 真实财报数据：',
      `- 营收：${actual.revenue}，同比 ${actual.revenueYoY}`,
      `- 毛利率：${actual.grossMargin}；说明：${actual.grossMarginNote}`,
      `- 摊薄每股收益：${actual.dilutedEps}，同比 ${actual.dilutedEpsYoY}；说明：${actual.dilutedEpsNote}`,
      `- 股息：${actual.dividend}；股权登记日 ${actual.dividendRecordDate}，派息日 ${actual.dividendPayableDate}`,
      `- 经营现金流：${actual.operatingCashFlowComment}`,
      `- 管理层摘要：${actual.managementQuoteSummary}`,
      '',
      `🎯 预期差结论：${verdictIcon} ${analysis.expectationGapConclusion}`,
      `- 判定理由：${analysis.expectationGapReason}`,
      '',
      '📈 利润表拆解：',
      `- ${analysis.incomeStatementAnalysis}`,
      '',
      '🧾 资产负债表拆解：',
      `- ${analysis.balanceSheetAnalysis}`,
      '',
      '💵 现金流量表拆解：',
      `- ${analysis.cashFlowAnalysis}`,
      '',
      '🧭 管理层展望判断：',
      `- ${analysis.managementOutlookAnalysis}`,
      '',
      '💹 股价与资金博弈判断：',
      `- ${analysis.priceActionAnalysis}`,
      '',
      '✨ 财报亮点：',
      ...bulletLines(analysis.highlights),
      '',
      '⚠️ 风险清单：',
      ...bulletLines(analysis.risks),
      '',
      `⏱️ 短期交易判断：${analysis.shortTermTradingView}`,
      `🧱 中长期基本面判断：${analysis.longTermFundamentalView}`,
      '',
      '🔍 仍需补充的数据：',
      ...bulletLines(analysis.missingData)
    ];
  }

  return [
    '📊 阶段B：财报发布后复盘',
    '- 当前状态：日历已经进入财报发布后阶段，但尚未接入公司正式财报、利润表、资产负债表、现金流量表、管理层展望和股价反应数据。',
    '- 是否符合预期：⚠️ 信息不足，暂不能判定。',
    '- 🎯 预期差结论：信息不足，暂不能判定为大幅超预期、符合预期、小幅不及预期或大幅不及预期。',
    '- 严格约束：不编造收入、利润、扣非净利润、现金流、资产负债或管理层展望数据。',
    '- 🔍 需要补充的信息：',
    `  - ${companyLabel} 正式财报全文或新闻稿。`,
    '  - 实际收入、每股收益、扣非/非 GAAP 利润口径、毛利率、营业利润率。',
    '  - 资产负债表关键项：现金、债务、应收、库存、商誉或减值。',
    '  - 现金流量表关键项：经营现金流、资本开支、自由现金流。',
    '  - 管理层展望：下一季度和全年收入、利润率、资本开支、需求趋势。',
    '  - 财报发布前 1 个月股价走势、财报后盘前/盘后涨跌幅、成交量和期权隐含波动率变化。',
    '- 待补充资料后输出：预期差结论、财报亮点、风险清单、短期交易判断、中长期基本面判断。'
  ];
}

function buildEarningsActionLines(event) {
  if (event.analysisPhase === 'B') {
    if (event.stageBAnalysis) {
      return [
        `- 🎯 预期差已经完成初步判定：${event.stageBAnalysis.expectationGapConclusion}。`,
        '- 💹 短线不要只看财报标题，优先观察常规交易时段成交量、缺口是否守住、相关 ETF 和同赛道股票是否确认方向。',
        '- 🔁 若后续补齐 10-Q、现金流和电话会指引，需要复核本次结论是否维持。',
        '- 🔒 已归档记录不再由自动任务覆盖或删除，后续只在你提供新资料时人工追加复盘。'
      ];
    }

    return [
      '- 📊 财报发布后：先补齐正式财报、三张表、管理层展望和股价反应数据，再做预期差判断。',
      '- 💹 交易层面：在真实数据未补齐前，不把盘前/盘后第一波涨跌当作最终结论；先观察常规交易成交量、缺口是否回补、相关 ETF 和同赛道股票是否确认方向。',
      '- 🔁 复盘层面：用阶段A留存的共识每股收益、分析师覆盖数量、财报周期和事前风险清单，和实际财报逐项对比。',
      '- ⚠️ 结论层面：资料不足时只输出待补充清单，不给“大幅超预期/不及预期”这类伪结论。'
    ];
  }

  return [
    '- 🧭 财报前：不要在事件前临时加重仓；已有仓位先确认最大可承受跳空，不符合就提前降仓。',
    '- 📊 财报发布时：先看营收、利润率、每股收益、下季度/全年指引和管理层措辞，不只看表面每股收益是否高于预期。',
    '- 💹 财报后：如果盘后/盘前大幅跳动，等常规交易前 15–30 分钟成交和期货反应稳定后再判断；不要用第一根波动直接追。',
    '- 🧺 组合层面：如果同时持有 QQQ/SPY 或同赛道股票，把它当成组合风险事件处理，而不是单一个股新闻。'
  ];
}

function buildEarningsDescription(event, meta) {
  const { eps, estimates } = extractEarningsContext(event);
  const mainTicker = event.ticker || event.assets[0];
  const companyLabel = event.companyChineseName && event.companyEnglishName
    ? `${event.companyChineseName}（${event.companyEnglishName}，${mainTicker}）`
    : mainTicker;
  const relatedAssets = event.assets.slice(1).join('、');
  const phase = event.analysisPhase || 'A';

  return [
    `日历名称：${DEFAULT_CALENDAR_NAME}`,
    `事件标题：${summary(event)}`,
    `事件时间：${eventDateTimeLabel(event)}`,
    `风险等级：${event.levelLabel || meta.label}`,
    `市场：${marketLabel(event.market)}`,
    `事件类型：${US_EARNINGS_WATCHLIST_SIZE} 个重点美股标的财报（仅滚动保留未来 30 天内数据）`,
    `分析阶段：${event.analysisPhaseLabel || (phase === 'B' ? '阶段B：财报发布后' : '阶段A：财报发布前')}`,
    `记录状态：${event.recordStatus || '跟踪中'}`,
    `分析锁定：${event.analysisLocked ? '是，已留存归档，后续自动更新不再覆盖或删除' : '否，仍在自动更新窗口内'}`,
    `分析更新时间：${event.analysisUpdatedAt || '未归档'}`,
    `时间可信度：${timeStatusLabel(event.timeStatus)}`,
    `数据来源：${event.sourceName}`,
    `来源链接：${event.sourceUrl}`,
    '',
    ...(phase === 'B' ? [
      ...buildStageBAnalysis(event, companyLabel),
      ''
    ] : []),
    '🧾 纳斯达克财报日历字段：',
    ...buildNasdaqFieldLines(event),
    '',
    '📌 当前真实数据摘要：',
    `- 🏷️ 标的：${companyLabel}`,
    `- 🗓️ 财报季度：${event.fiscalQuarter || event.title.split('：').at(-1)}`,
    `- 🎯 纳斯达克共识每股收益：${eps}`,
    `- 👥 覆盖分析师数量：${estimates}`,
    `- ⏰ 财报发布时间特征：${timingLabel(event)}`,
    '',
    ...(phase === 'A' ? buildStageAAnalysis(event, companyLabel, relatedAssets, eps, estimates) : []),
    '',
    '🌐 影响范围：',
    `- 🎯 直接影响：${companyLabel} 本身的盘前/盘后跳空、期权隐含波动率和成交量。`,
    `- 📈 指数影响：${relatedAssets || '相关指数与 ETF'}，尤其是财报后第一个常规交易时段。`,
    '- 🔗 产业链影响：如果指引明显偏离预期，会外溢到同赛道公司、供应链、客户和竞争对手。',
    '- 🧠 情绪影响：超大市值公司财报容易改变市场对成长、消费、防御或周期板块的风险偏好。',
    '',
    '🧭 操作建议：',
    ...buildEarningsActionLines(event),
    '',
    '✅ 检查清单：',
    ...event.checklist.map((item) => `- 🔎 ${item}`)
  ].join('\n');
}

function buildDescription(event) {
  const meta = LEVEL_META[event.level];
  if (event.category === 'Earnings / US Megacap') return buildEarningsDescription(event, meta);
  if (event.category === 'Derivatives / CFFEX Position Watch' && event.cffexPositionAnalysis) {
    const analysis = event.cffexPositionAnalysis;
    const citic = analysis.citic.overall;
    const top20 = analysis.top20.overall;
    const impact = buildCffexMarketImpact(analysis);
    return [
      '🧭 市场影响总结：',
      `- 🎯 总判断：${impact.directionalConclusion}。这是风险偏好线索，不是确定的涨跌信号。`,
      `- 🔮 明日涨跌预判：${impact.forecastEmoji} ${impact.forecastDirection}。`,
      `- 🎚️ 确定度：${impact.forecastScore}/100（${impact.forecastConfidence}）。`,
      `- 🧠 预判依据：${impact.forecastBasis}`,
      `- ⚖️ 信号强度：中信净差占当日多空调整绝对值的 ${impact.adjustmentRatioText}；前20席位净${top20.directionLabel}${Math.abs(top20.netPosition)}手，占多空持仓合计的 ${impact.top20ImbalanceRatioText}。`,
      '',
      '📌 中金所成交持仓排名数据：',
      `- 🗓️ 数据交易日：${analysis.tradeDate}`,
      `- 🕔 抓取时间：${analysis.fetchedAt}`,
      '',
      '🏦 中信期货分品种净变化：',
      ...analysis.citic.details.map((item) => `- ${item.product}（${item.name}）：${item.directionEmoji} ${item.directionLabel}${Math.abs(item.netChange)}手；持买增减 ${item.longChange}手，持卖增减 ${item.shortChange}手。`),
      `- 📊 中信整体：${analysis.citic.overall.directionEmoji} ${analysis.citic.overall.directionLabel}${Math.abs(analysis.citic.overall.netChange)}手。`,
      '',
      '🏛️ 前20机构合计：',
      ...analysis.top20.details.map((item) => `- ${item.product}（${item.name}）：持买 ${item.longPosition}手，持卖 ${item.shortPosition}手，${item.directionEmoji} 净${item.directionLabel}${Math.abs(item.netPosition)}手。`),
      `- 📊 前20机构整体：持买 ${analysis.top20.overall.longPosition}手，持卖 ${analysis.top20.overall.shortPosition}手，${analysis.top20.overall.directionEmoji} 净${analysis.top20.overall.directionLabel}${Math.abs(analysis.top20.overall.netPosition)}手。`,
    ].join('\n');
  }

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
    '📌 当前真实数据与市场含义：',
    `- 🎯 市场预期：${event.marketExpectation}`,
    `- ⚠️ 风险原因：${event.reason}`,
    '',
    '🌐 影响范围：',
    `- 🎯 主要影响资产：${event.assets.join('、')}`,
    `- 📈 市场层级：${marketLabel(event.market)}，并可能通过相关 ETF、指数期货、期权和跨市场情绪外溢。`,
    `- 🧭 历史反应：${event.historicalReaction}`,
    '',
    '🧭 操作建议：',
    `- 🛡️ ${event.actionPlan}`,
    '- ⏳ 事件前先处理仓位和止损，不把方向判断留到波动最大的时段。',
    '- 📈 事件后等第一轮价格反应、成交量和相关资产联动确认，再决定是否跟进。',
    '',
    '✅ 检查清单：',
    ...event.checklist.map((item) => `- 🔎 ${item}`)
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

function alarmTriggersForEvent(event, meta) {
  if (
    event.category === 'Derivatives / CFFEX Position Watch' ||
    event.category === 'Derivatives / CFFEX Follow-up Review'
  ) {
    return ['PT0S'];
  }

  return meta.alarmTriggers;
}

function renderEvent(event) {
  const meta = LEVEL_META[event.level];
  const displayStart = eventDisplayDateTime(event, CALENDAR_DISPLAY_START_TIME);
  const displayEnd = eventDisplayDateTime(event, CALENDAR_DISPLAY_END_TIME);
  return [
    'BEGIN:VEVENT',
    `UID:${stableUid(event)}`,
    `DTSTAMP:${stableTimestamp(event)}`,
    `DTSTART;TZID=Asia/Shanghai:${formatDateTime(displayStart)}`,
    `DTEND;TZID=Asia/Shanghai:${formatDateTime(displayEnd)}`,
    `LOCATION:${escapeText(event.location)}`,
    `SUMMARY:${escapeText(summary(event))}`,
    `DESCRIPTION:${escapeText(buildDescription(event))}`,
    'CATEGORIES:交易风险',
    'TRANSP:TRANSPARENT',
    `X-RISK-LEVEL:${event.levelLabel || meta.label}`,
    `X-SOURCE-URL:${escapeText(event.sourceUrl)}`,
    ...alarmTriggersForEvent(event, meta).map((trigger) => renderAlarm(event, trigger)),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
