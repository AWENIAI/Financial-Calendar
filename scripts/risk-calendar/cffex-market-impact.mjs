function ratio(value, denominator) {
  return denominator ? Math.abs(value) / denominator : 0;
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function sameDirection(left, right) {
  return left !== 0 && right !== 0 && Math.sign(left) === Math.sign(right);
}

export function buildCffexMarketImpact(analysis) {
  const citic = analysis.citic.overall;
  const top20 = analysis.top20.overall;
  const totalAdjustment = Math.abs(citic.longChange) + Math.abs(citic.shortChange);
  const adjustmentRatio = ratio(citic.netChange, totalAdjustment);
  const top20GrossPosition = top20.longPosition + top20.shortPosition;
  const top20ImbalanceRatio = ratio(top20.netPosition, top20GrossPosition);
  const citicDirection = citic.netChange >= 0 ? '净偏多' : '净偏空';
  const directionEmoji = citic.netChange >= 0 ? '🔴' : '🟢';
  const strengthLabel = adjustmentRatio < 0.05 ? '轻度' : adjustmentRatio < 0.15 ? '中度' : '明显';
  let positionNature;
  let positionExplanation;

  if (citic.longChange < 0 && citic.shortChange < 0) {
    positionNature = `减仓型${citicDirection}`;
    positionExplanation = citic.netChange < 0
      ? `中信多单减少${Math.abs(citic.longChange)}手、空单减少${Math.abs(citic.shortChange)}手；这不是主动新增${Math.abs(citic.netChange)}手空单，而是多单减得更多。`
      : `中信多单减少${Math.abs(citic.longChange)}手、空单减少${Math.abs(citic.shortChange)}手；这不是主动新增${Math.abs(citic.netChange)}手多单，而是空单减得更多。`;
  } else if (citic.longChange > 0 && citic.shortChange > 0) {
    positionNature = `增仓型${citicDirection}`;
    positionExplanation = `中信多单增加${citic.longChange}手、空单增加${citic.shortChange}手，双方都在增仓，但${citic.netChange >= 0 ? '多单' : '空单'}增加得更多。`;
  } else if (citic.longChange >= 0 && citic.shortChange <= 0) {
    positionNature = '多头强化型净偏多';
    positionExplanation = `中信多单增加${citic.longChange}手，同时空单减少${Math.abs(citic.shortChange)}手，多空两端共同形成净偏多。`;
  } else if (citic.longChange <= 0 && citic.shortChange >= 0) {
    positionNature = '空头强化型净偏空';
    positionExplanation = `中信多单减少${Math.abs(citic.longChange)}手，同时空单增加${citic.shortChange}手，多空两端共同形成净偏空。`;
  } else {
    positionNature = `持仓基本稳定型${citicDirection}`;
    positionExplanation = '中信多空持仓变化都很小，当前净变化不适合放大解释。';
  }

  const directionsAgree = sameDirection(citic.netChange, top20.netPosition);
  const weightedSignal = totalAdjustment || top20GrossPosition
    ? (Math.sign(citic.netChange) * adjustmentRatio * 0.6) + (Math.sign(top20.netPosition) * top20ImbalanceRatio * 0.4)
    : 0;
  const forecastDirection = weightedSignal > 0 ? '偏涨' : weightedSignal < 0 ? '偏跌' : '方向不明';
  const forecastEmoji = forecastDirection === '偏涨' ? '📈' : forecastDirection === '偏跌' ? '📉' : '↔️';
  let forecastScore = forecastDirection === '方向不明' ? 15 : 30;

  if (directionsAgree) forecastScore += 5;
  if (adjustmentRatio >= 0.15) forecastScore += 20;
  else if (adjustmentRatio >= 0.05) forecastScore += 10;
  if (top20ImbalanceRatio >= 0.2) forecastScore += 15;
  else if (top20ImbalanceRatio >= 0.1) forecastScore += 10;
  else if (top20ImbalanceRatio >= 0.05) forecastScore += 5;
  if ((citic.longChange >= 0 && citic.shortChange <= 0) || (citic.longChange <= 0 && citic.shortChange >= 0)) forecastScore += 10;
  forecastScore = Math.min(80, forecastScore);

  const forecastConfidence = forecastScore < 45 ? '低' : forecastScore < 65 ? '中' : '较高';
  const confidenceLabel = adjustmentRatio < 0.05 ? '低' : adjustmentRatio < 0.15 ? '中' : '中等';
  const agreementText = directionsAgree
    ? `中信与前20方向同为${citic.netChange >= 0 ? '偏多' : '偏空'}`
    : '中信变化与前20净持仓方向不一致';
  const forecastBasis = `${agreementText}；中信净差强度为${percent(adjustmentRatio)}，前20净头寸占比为${percent(top20ImbalanceRatio)}；当前没有纳入次日价格、成交量和外部资金确认。`;

  return {
    adjustmentRatio,
    adjustmentRatioText: percent(adjustmentRatio),
    top20ImbalanceRatio,
    top20ImbalanceRatioText: percent(top20ImbalanceRatio),
    directionEmoji,
    strengthLabel,
    confidenceLabel,
    directionalConclusion: `${directionEmoji} ${strengthLabel}${citic.netChange >= 0 ? '偏多' : '偏空'}（${confidenceLabel}置信度）`,
    positionNature,
    positionExplanation,
    forecastDirection,
    forecastEmoji,
    forecastScore,
    forecastConfidence,
    forecastBasis,
    forecastDisclaimer: '确定度是基于持仓方向、强度和一致性的规则置信分，不是统计胜率，也不是收益保证。',
    bearishConfirmation: '次日股指期货与现货同步走弱、反弹无量，并且后续净空继续扩大；满足越多，偏空判断越可信。',
    squeezeConfirmation: '净空背景下指数仍不跌、低开快速收回且放量转强，空头回补才可能放大上涨；这属于价格确认后的逼空情景，不是看到空单就预判大涨。'
  };
}
