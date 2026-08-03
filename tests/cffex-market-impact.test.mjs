import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCffexMarketImpact } from '../scripts/risk-calendar/cffex-market-impact.mjs';

const sampleAnalysis = {
  citic: {
    overall: {
      longChange: -13568,
      shortChange: -12892,
      netChange: -676
    }
  },
  top20: {
    overall: {
      longPosition: 873737,
      shortPosition: 1018141,
      netPosition: -144404,
      directionLabel: '空单'
    }
  }
};

test('减仓型净偏空不能被解释成主动新增空单', () => {
  const impact = buildCffexMarketImpact(sampleAnalysis);

  assert.equal(impact.positionNature, '减仓型净偏空');
  assert.match(impact.positionExplanation, /不是主动新增676手空单/);
  assert.equal(impact.adjustmentRatioText, '2.55%');
  assert.equal(impact.top20ImbalanceRatioText, '7.63%');
});

test('同向但力度弱的净偏空输出明日偏跌和低确定度', () => {
  const impact = buildCffexMarketImpact(sampleAnalysis);

  assert.equal(impact.forecastDirection, '偏跌');
  assert.equal(impact.forecastScore, 40);
  assert.equal(impact.forecastConfidence, '低');
  assert.match(impact.forecastBasis, /中信与前20方向同为偏空/);
  assert.match(impact.forecastDisclaimer, /规则置信分，不是统计胜率/);
});
