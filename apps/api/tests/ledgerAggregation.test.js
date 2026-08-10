import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASH_ACCOUNT_CODES,
  buildMonthBuckets,
  applyCashRows,
  finaliseMonths,
  applySectionRules,
  ymd,
} from '../services/ledgerAggregation.js';
import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping';

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

test('buildMonthBuckets handles a range inside a single month', () => {
  const buckets = buildMonthBuckets('2026-03-05', '2026-03-28');
  assert.deepEqual(Object.keys(buckets), ['2026-03']);
});

test('finaliseMonths rounds accumulated floats to cents', () => {
  const buckets = buildMonthBuckets('2026-01-01', '2026-01-31');
  applyCashRows(buckets, [
    { month: '2026-01', inflow: '100.10', outflow: '0' },
    { month: '2026-01', inflow: '200.20', outflow: '0' },
    { month: '2026-01', inflow: '50.30', outflow: '0' },
  ]);
  // Unrounded this accumulates to 350.59999999999997
  assert.equal(finaliseMonths(buckets)[0].income, 350.6);
});

test('applySectionRules rounds accumulated floats to cents', () => {
  const totals = applySectionRules([
    { section: 'D2', amount: '100.10' },
    { section: 'D2', amount: '200.20' },
    { section: 'D2', amount: '50.30' },
  ]);
  assert.equal(totals.D2, 350.6);
});

test('applySectionRules takes the D15 rate from the shared constants', () => {
  // Proves the rate is read, not hardcoded: it must match the shared source.
  assert.equal(BORANG_B_SECTIONS.D15.deductibilityRate, 0.5);
  assert.equal(applySectionRules([{ section: 'D15', amount: '1000' }]).D15, 500);
});

test('ymd zero-pads single-digit months and days', () => {
  assert.equal(ymd(new Date(2026, 0, 1)), '2026-01-01');
  assert.equal(ymd(new Date(2026, 8, 5)), '2026-09-05');
});

test('ymd does not shift the date across the UTC boundary (regression)', () => {
  // Regression coverage for the timezone bug: .toISOString().split('T')[0]
  // converts to UTC first, which on hosts east of UTC (e.g. +08) shifts a
  // locally-constructed calendar date back by one day. ymd() must not do that.
  assert.equal(ymd(new Date(2026, 7, 1)), '2026-08-01');
  assert.equal(ymd(new Date(2026, 8, 0)), '2026-08-31');
});

test('ymd keeps the local calendar year at a UTC year boundary', () => {
  // At +08 this instant is 2026-12-31 in UTC but 2027-01-01 locally.
  assert.equal(ymd(new Date(2027, 0, 1)), '2027-01-01');
  assert.equal(ymd(new Date(2026, 11, 31)), '2026-12-31');
});
