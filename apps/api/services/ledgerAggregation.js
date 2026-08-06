import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping';

// Cash inflow = debit to these; cash outflow = credit to these.
// Credit Card (2300) is a liability, not cash — a card purchase becomes an
// outflow only when the card itself is paid off.
export const CASH_ACCOUNT_CODES = ['1000', '1010'];

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
    .map((k) => ({ ...buckets[k], net: buckets[k].income - buckets[k].expenses }));
}

export function applySectionRules(sectionRows) {
  const totals = {};
  Object.keys(BORANG_B_SECTIONS).forEach((sec) => { totals[sec] = 0; });

  for (const row of sectionRows || []) {
    if (!Object.prototype.hasOwnProperty.call(totals, row.section)) continue;
    let amount = parseFloat(row.amount || 0);
    if (row.section === 'D15') amount *= 0.5; // Entertainment is 50% deductible
    totals[row.section] += amount;
  }
  return totals;
}
