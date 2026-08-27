import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataPath = path.join(root, 'data/strategy-a.json');
const statePath = path.join(root, 'data/strategy-a-state.json');
const api = 'http://hq.cnindex.com.cn/market/market/getIndexDailyDataWithDataFormat';

async function get(code) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const response = await fetch(`${api}?indexCode=${code}&startDate=${start}&endDate=${end}&frequency=day`);
  if (!response.ok) throw new Error(`${code} HTTP ${response.status}`);
  const { data } = await response.json();
  const expected = { '480080': ['成长100R', 'CNIG100 TRI'], '480081': ['价值100R', 'CNIV100 TRI'] }[code];
  if (data?.indexCode !== code || data.indexName !== expected[0] || data.indexEName !== expected[1]) throw new Error(`${code} TRI口径校验失败`);
  const close = data.item.indexOf('close');
  return Object.fromEntries(data.data.filter(row => row[close] != null).map(row => [row[0], Number(row[close])]));
}

function writeEvent(event) { fs.writeFileSync(dataPath, JSON.stringify([event], null, 2) + '\n'); }

try {
  const [g, v] = await Promise.all([get('480080'), get('480081')]);
  const dates = Object.keys(g).filter(d => d in v).sort();
  if (dates.length < 21) throw new Error('共同有效交易日不足21个');
  const date = dates.at(-1), old = dates.at(-21);
  const rg = g[date] / g[old] - 1, rv = v[date] / v[old] - 1, d = (rg - rv) * 100;
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const position = state.currentPosition;
  if (!['VALUE', 'GROWTH'].includes(position)) throw new Error('当前持仓状态无效');
  const target = position === 'VALUE' && d > 1 ? 'GROWTH' : position === 'GROWTH' && d < -1 ? 'VALUE' : position;
  const result = target !== position ? (target === 'GROWTH' ? '从价值切换到成长' : '从成长切换到价值') : position === 'VALUE' ? '保持当前价值' : '保持当前成长';
  const reason = target !== position ? `成长100R的20日收益减去价值100R的20日收益，得到${d >= 0 ? '+' : ''}${d.toFixed(4)}pp，严格超过触发阈值。因此在下一交易日从“${position === 'VALUE' ? '价值' : '成长'}”切换至“${target === 'GROWTH' ? '成长' : '价值'}”。` : `成长100R的20日收益减去价值100R的20日收益，得到${d >= 0 ? '+' : ''}${d.toFixed(4)}pp，未满足当前持仓的反向切换条件。因此保持当前持仓。`;
  const description = `结果：${result}\n\n数据口径：480080 / 480081\n成长100R：${g[date].toFixed(4)}\n价值100R：${v[date].toFixed(4)}\n成长20日累计收益：${(rg * 100).toFixed(4)}%\n价值20日累计收益：${(rv * 100).toFixed(4)}%\n相对收益差：${d >= 0 ? '+' : ''}${d.toFixed(4)}pp\n\n理由：${reason}`;
  writeEvent({ market: 'CN', level: 'high', levelLabel: '高', category: 'Strategy A', title: `策略 A｜${result}`, start: `${date}T15:10:00+08:00`, end: `${date}T15:15:00+08:00`, timezone: 'Asia/Shanghai', location: '中国', assets: ['成长100R', '价值100R'], timeStatus: 'confirmed', sourceName: '国证指数', sourceUrl: 'https://www.cnindex.com.cn/', strategyDescription: description });
  fs.writeFileSync(statePath, JSON.stringify({ currentPosition: target, tradeCount: state.tradeCount + Number(target !== position), lastSignalDate: date, lastResult: result }, null, 2) + '\n');
  console.log(`策略 A｜${result}`);
} catch (error) {
  writeEvent({ market: 'CN', level: 'high', levelLabel: '高', category: 'Strategy A', title: '策略 A｜数据错误无结果', start: `${new Date().toISOString().slice(0, 10)}T15:10:00+08:00`, end: `${new Date().toISOString().slice(0, 10)}T15:15:00+08:00`, timezone: 'Asia/Shanghai', location: '中国', assets: ['480080', '480081'], timeStatus: 'confirmed', sourceName: '国证指数', sourceUrl: 'https://www.cnindex.com.cn/', strategyDescription: `结果：数据错误无结果\n\n数据口径：480080 / 480081\n\n理由：${error.message}` });
  console.error(error.message);
  process.exitCode = 1;
}
