import assert from 'node:assert/strict';
import test from 'node:test';
import { SUBSCRIBED_EARNINGS_SYMBOLS } from '../scripts/risk-calendar/generate-risk-calendar.mjs';
import { WATCHLIST } from '../scripts/risk-calendar/update-us-megacap-earnings.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { buildCffexMarketImpact } from '../scripts/risk-calendar/cffex-market-impact.mjs';

test('中金所次日复盘用收盘结果验证前一交易日席位信号', () => {
  const impact = buildCffexMarketImpact({
    citic: {
      overall: { longChange: 100, shortChange: 40, netChange: 60 }
    },
    top20: {
      overall: { longPosition: 1000, shortPosition: 940, netPosition: 60, directionLabel: '多单' }
    }
  });

  assert.equal(impact.forecastDirection, '偏涨');
  assert.match(impact.squeezeConfirmation, /不是看到空单就预判大涨/);
});

const REQUIRED_COMPANIES = [
  { symbol: 'NVDA', chineseName: '英伟达', englishName: 'NVIDIA' },
  { symbol: 'MSFT', chineseName: '微软', englishName: 'Microsoft' },
  { symbol: 'AMZN', chineseName: '亚马逊', englishName: 'Amazon' },
  { symbol: 'GOOGL', chineseName: '谷歌母公司 Alphabet', englishName: 'Alphabet', aliases: ['GOOG'] },
  { symbol: 'META', chineseName: 'Meta 平台', englishName: 'Meta Platforms' },
  { symbol: 'AAPL', chineseName: '苹果', englishName: 'Apple' },
  { symbol: 'TSLA', chineseName: '特斯拉', englishName: 'Tesla' },
  { symbol: 'AVGO', chineseName: '博通', englishName: 'Broadcom' },
  { symbol: 'PLTR', chineseName: '帕兰提尔', englishName: 'Palantir Technologies' },
  { symbol: 'ORCL', chineseName: '甲骨文', englishName: 'Oracle' },
  { symbol: 'MU', chineseName: '美光科技', englishName: 'Micron' },
  { symbol: 'WDC', chineseName: '西部数据', englishName: 'Western Digital' },
  { symbol: 'STX', chineseName: '希捷科技', englishName: 'Seagate Technology' },
  { symbol: 'SNDK', chineseName: '闪迪', englishName: 'SanDisk' }
];

test('美股财报订阅池覆盖用户指定的 14 家公司', () => {
  const bySymbol = new Map(WATCHLIST.map((company) => [company.symbol, company]));

  for (const required of REQUIRED_COMPANIES) {
    const company = bySymbol.get(required.symbol);
    assert.ok(company, `${required.symbol} should be subscribed`);
    assert.equal(company.chineseName, required.chineseName);
    assert.equal(company.englishName, required.englishName);

    for (const alias of required.aliases || []) {
      assert.ok(company.aliases?.includes(alias), `${required.symbol} should include alias ${alias}`);
    }
  }
});

test('美股财报订阅池没有重复 ticker', () => {
  const symbols = WATCHLIST.map((company) => company.symbol);
  assert.equal(new Set(symbols).size, symbols.length);
});

test('日历生成器不会过滤掉用户指定的 14 家公司', () => {
  for (const required of REQUIRED_COMPANIES) {
    assert.ok(SUBSCRIBED_EARNINGS_SYMBOLS.has(required.symbol), `${required.symbol} should be allowed into ICS`);
  }
});

test('伯克希尔阶段B已留存官方财报真实数据', () => {
  const dataPath = path.join(process.cwd(), 'data/us-megacap-earnings.json');
  const events = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const berkshire = events.find((event) => event.ticker === 'BRK.B');
  assert.ok(berkshire, 'BRK.B should exist in earnings data');
  assert.equal(berkshire.analysisPhase, 'B');
  assert.equal(berkshire.reportedFinancials?.dilutedEps, '$11.91');
  assert.equal(berkshire.reportedFinancials?.operatingEarnings, '$12,983 million');
  assert.equal(berkshire.reportedFinancials?.netEarnings, '$25,667 million');
  assert.match(berkshire.reportedFinancials?.sourceUrl || '', /berkshirehathaway\.com\/news\/aug0826\.pdf/);
});
