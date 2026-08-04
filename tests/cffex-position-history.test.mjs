import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCffexPositionEvents } from '../scripts/risk-calendar/cffex-position-history.mjs';

function event(tradeDate, marker) {
  return {
    title: `${tradeDate}-${marker}`,
    cffexPositionAnalysis: { tradeDate, marker }
  };
}

test('新交易日写入时保留已有中金所历史记录', () => {
  const existing = [event('2026-08-03', '旧记录'), event('2026-08-04', '当前记录')];

  const merged = mergeCffexPositionEvents(existing, event('2026-08-05', '新记录'));

  assert.deepEqual(
    merged.map((item) => item.cffexPositionAnalysis.tradeDate),
    ['2026-08-03', '2026-08-04', '2026-08-05']
  );
});

test('同一交易日重跑时更新当天记录且不产生重复', () => {
  const existing = [event('2026-08-03', '旧记录'), event('2026-08-04', '旧版本')];

  const merged = mergeCffexPositionEvents(existing, event('2026-08-04', '新版本'));

  assert.equal(merged.length, 2);
  assert.equal(merged[1].cffexPositionAnalysis.marker, '新版本');
});
