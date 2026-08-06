import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASH_ACCOUNT_CODES,
  buildMonthBuckets,
  applyCashRows,
  finaliseMonths,
  applySectionRules,
} from '../services/ledgerAggregation.js';

test('cash accounts are exactly cash-on-hand and bank', () => {
  assert.deepEqual(CASH_ACCOUNT_CODES, ['1000', '1010']);
});

test('buildMonthBuckets zero-fills every month in range inclusive', () => {
  const buckets = buildMonthBuckets('2026-01-15', '2026-03-02');
  assert.deepEqual(Object.keys(buckets), ['2026-01', '2026-02', '2026-03']);
  assert.equal(buckets['2026-02'].income, 0);
  assert.equal(buckets['2026-02'].expenses, 0);
});

test('buildMonthBuckets spans a year boundary', () => {
  const buckets = buildMonthBuckets('2025-11-01', '2026-02-28');
  assert.deepEqual(Object.keys(buckets), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('applyCashRows maps debits to income and credits to expenses', () => {
  const buckets = buildMonthBuckets('2026-01-01', '2026-02-28');
  applyCashRows(buckets, [
    { month: '2026-01', inflow: '1000.00', outflow: '250.50' },
    { month: '2026-02', inflow: '0', outflow: '99.99' },
  ]);
  assert.equal(buckets['2026-01'].income, 1000);
  assert.equal(buckets['2026-01'].expenses, 250.5);
  assert.equal(buckets['2026-02'].expenses, 99.99);
});

test('applyCashRows ignores rows outside the requested range', () => {
  const buckets = buildMonthBuckets('2026-01-01', '2026-01-31');
  applyCashRows(buckets, [{ month: '2025-12', inflow: '500', outflow: '0' }]);
  assert.equal(buckets['2026-01'].income, 0);
});

test('finaliseMonths sorts ascending and computes net', () => {
  const buckets = buildMonthBuckets('2026-01-01', '2026-02-28');
  applyCashRows(buckets, [{ month: '2026-02', inflow: '300', outflow: '100' }]);
  const result = finaliseMonths(buckets);
  assert.equal(result.length, 2);
  assert.equal(result[1].net, 200);
  assert.equal(result[0].net, 0);
});

test('applySectionRules zero-fills all sections and halves D15', () => {
  const totals = applySectionRules([
    { section: 'D2', amount: '5000' },
    { section: 'D15', amount: '1000' },
  ]);
  assert.equal(totals.D2, 5000);
  assert.equal(totals.D15, 500);
  assert.equal(totals.D7, 0);
  assert.ok('D20' in totals);
});

test('applySectionRules ignores unknown sections', () => {
  const totals = applySectionRules([{ section: 'D99', amount: '123' }]);
  assert.ok(!('D99' in totals));
});
