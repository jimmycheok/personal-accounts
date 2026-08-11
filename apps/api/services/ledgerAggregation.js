import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping';

// Cash inflow = debit to these; cash outflow = credit to these.
// Credit Card (2300) is a liability, not cash — a card purchase becomes an
// outflow only when the card itself is paid off.
export const CASH_ACCOUNT_CODES = ['1000', '1010'];

// Accumulating floats drifts (100.10 + 200.20 + 50.30 === 350.59999999999997),
// so every figure this module returns is rounded to cents at the boundary.
// Accumulation stays full-precision; only the returned value is rounded.
const toCents = (n) => Math.round(n * 100) / 100;

// Local calendar date, NOT `.toISOString()` — that converts to UTC first and
// shifts the month boundary back a day on any host east of UTC.
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function buildMonthBuckets(from, to) {
  const buckets = {};
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00`);
  while (cursor <= end) {
    buckets[monthKey(cursor)] = {
      month: cursor.toLocaleString('en-MY', { month: 'short', year: '2-digit' }),
      income: 0,
      expenses: 0,
      net: 0,
    };
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export function applyCashRows(buckets, rows) {
  for (const row of rows || []) {
    const bucket = buckets[row.month];
    if (!bucket) continue;
    bucket.income += parseFloat(row.inflow || 0);
    bucket.expenses += parseFloat(row.outflow || 0);
  }
}

export function finaliseMonths(buckets) {
  return Object.keys(buckets)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({
      ...buckets[k],
      income: toCents(buckets[k].income),
      expenses: toCents(buckets[k].expenses),
      net: toCents(buckets[k].income - buckets[k].expenses),
    }));
}

export function applySectionRules(sectionRows) {
  const totals = {};
  Object.keys(BORANG_B_SECTIONS).forEach((sec) => { totals[sec] = 0; });

  for (const row of sectionRows || []) {
    if (!Object.prototype.hasOwnProperty.call(totals, row.section)) continue;
    // Partial deductibility (D15 Entertainment at 50%) is defined once, in the
    // shared constants, so a rate change there takes effect everywhere.
    const rate = BORANG_B_SECTIONS[row.section]?.deductibilityRate ?? 1;
    totals[row.section] += parseFloat(row.amount || 0) * rate;
  }

  for (const sec of Object.keys(totals)) totals[sec] = toCents(totals[sec]);
  return totals;
}

// D5 (Motor Vehicle Expenses) is funded by two accounts that must never
// overlap for the same trip: 6400 for actual receipts (fuel, maintenance,
// toll/parking) and 6410 for per-km mileage claims. A per-km rate is meant
// to *substitute* for actual costs, not add to them, so a month where both
// accounts have posted activity is a signal — not proof — that the same
// trip may have been claimed twice.
export const VEHICLE_RECEIPTS_ACCOUNT_CODE = '6400';
export const MILEAGE_CLAIM_ACCOUNT_CODE = '6410';

/**
 * Shapes `{ month, code, amount }` rows — one row per (month, account) pair
 * — into the months where BOTH the receipts account and the mileage account
 * have net-positive activity. Months where only one side is used are not
 * overlap and are dropped.
 */
export function findMileageOverlapMonths(rows) {
  const byMonth = {};
  for (const row of rows || []) {
    const month = row.month;
    if (!month) continue;
    if (!byMonth[month]) byMonth[month] = { month, receiptsTotal: 0, mileageTotal: 0 };
    const amount = parseFloat(row.amount || 0);
    if (row.code === VEHICLE_RECEIPTS_ACCOUNT_CODE) byMonth[month].receiptsTotal += amount;
    else if (row.code === MILEAGE_CLAIM_ACCOUNT_CODE) byMonth[month].mileageTotal += amount;
  }

  return Object.keys(byMonth)
    .filter((k) => byMonth[k].receiptsTotal > 0 && byMonth[k].mileageTotal > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({
      month: k,
      receiptsTotal: toCents(byMonth[k].receiptsTotal),
      mileageTotal: toCents(byMonth[k].mileageTotal),
    }));
}
