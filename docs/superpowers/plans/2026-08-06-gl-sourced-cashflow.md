# GL-Sourced Cash Flow, Dashboard & Tax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the General Ledger the single source of truth for cash flow, dashboard totals and Borang B tax figures, so that Payment Vouchers (and every other money movement) appear consistently across all surfaces.

**Architecture:** Today, Cash Flow / Dashboard / TaxCalculator read the `expenses` and `invoices` tables directly, while Payment Vouchers only write to `journal_entries`. This makes PVs invisible to those three surfaces. We invert the dependency: a new `LedgerQueryService` answers all money questions from `journal_entry_lines` joined to `accounts`. Because that is only safe if the GL is complete, we first make GL posting unconditional (server-side fallback lines, which already exist but are unused) and backfill historical gaps.

**Tech Stack:** Node 23 ESM, Express 5, Sequelize 6 (PostgreSQL), raw `sequelize.query` for aggregations, `node:test` + `node:assert/strict` for tests (built in, no new dependencies), React 18 + Carbon v11 frontend.

## Global Constraints

- Branch: `feat/gl-sourced-cashflow`, branched from `origin/main`. Do **not** merge or push without explicit instruction from Jimmy.
- API is ESM (`"type": "module"`). Migrations and seeders MUST use `.cjs`.
- Cash accounts are **exactly** `1000` (Cash on Hand) and `1010` (Bank Account). `2300` Credit Card is a liability and is deliberately NOT cash — a card purchase becomes a cash outflow only when the card is paid.
- Cash **inflow** = debit to a cash account. Cash **outflow** = credit to a cash account.
- Only `journal_entries.status = 'posted'` count. Draft entries are excluded everywhere.
- Existing D15 (Entertainment) 50% deductibility rule must be preserved.
- Money is compared to 2 decimal places; use a `0.01` epsilon for balance assertions, matching `JournalEntryService.#createEntry`.
- Do not change PV behaviour — PV already posts GL correctly and is the reference implementation.
- All new SQL uses bound `:replacements`, never string interpolation.

## Out of Scope (deliberately — flagged to Jimmy, not fixed here)

- `is_capital_allowance` on `ExpenseCategory` is dead code (never read by `TaxCalculator`), so capital items like the Mac Mini are deducted 100% in year one instead of via capital allowances. Real bug; needs a fixed-asset register and depreciation schedule. Separate piece of work.
- `TaxCalculator.getMileageDeduction` (`TaxCalculator.js:66`) uses a flat `0.25`/km, which contradicts the documented RM0.60 / RM0.40 tiered rate. Separate fix.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/services/ledgerAggregation.js` (create) | Pure functions: month bucketing, section totals, D15 rule. No DB — unit testable. |
| `apps/api/services/LedgerQueryService.js` (create) | SQL against `journal_entry_lines`; delegates shaping to `ledgerAggregation.js`. |
| `apps/api/seeders/20260806000001-non-deductible-account.cjs` (create) | Adds account `6995 Non-Deductible Expenses` (no Borang B section). |
| `apps/api/scripts/backfill-journal-entries.js` (create) | Dry-run + apply backfill of missing GL entries. |
| `apps/api/controllers/expensesController.js` (modify) | Fallback GL posting when client sends no `journal_lines`. |
| `apps/api/routes/payments.js` (modify) | Same fallback. |
| `apps/api/controllers/invoicesController.js` (modify) | Same fallback for send / markPaid. |
| `apps/api/services/JournalEntryService.js` (modify) | Route non-deductible expenses to `6995`. |
| `apps/api/routes/cashFlow.js` (modify) | `/actual` reads the GL. |
| `apps/api/services/CashFlowService.js` (modify) | `getProjection` actuals + `getActual` read the GL. |
| `apps/api/controllers/dashboardController.js` (modify) | `overview` reads the GL. |
| `apps/api/services/TaxCalculator.js` (modify) | `getExpensesBySection` reads the GL. |
| `apps/api/tests/ledgerAggregation.test.js` (create) | Unit tests for the pure helpers. |
| `apps/web/src/components/ModuleIntro.jsx` (create) | Shared one-line explainer under a page title. |
| `apps/web/src/pages/Expenses/index.jsx` (modify) | Add explainer. |
| `apps/web/src/pages/PaymentVouchers/index.jsx` (modify) | Add explainer. |

---

### Task 1: Non-deductible expense account

Today `Expense.is_tax_deductible = false` keeps an expense out of the tax calc. Once tax reads the GL, that flag is invisible — the expense still debits a normal expense account. We need a GL account with **no** `borang_b_section` so the tax query excludes it naturally while P&L still shows it.

**Files:**
- Create: `apps/api/seeders/20260806000001-non-deductible-account.cjs`

**Interfaces:**
- Produces: account code `'6995'`, name `'Non-Deductible Expenses'`, `account_type: 'expense'`, `sub_type: 'operating_expense'`, `borang_b_section: null`. Task 3 and Task 7 rely on this code existing.

- [ ] **Step 1: Write the seeder**

```javascript
'use strict';

/** Expenses that are real business costs but not claimable against tax.
 *  borang_b_section is NULL so GL-sourced tax queries skip it automatically. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM accounts WHERE code = '6995'",
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('accounts', [{
      code: '6995',
      name: 'Non-Deductible Expenses',
      account_type: 'expense',
      sub_type: 'operating_expense',
      borang_b_section: null,
      description: 'Business costs that are not claimable against income tax',
      is_system: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accounts', { code: '6995' });
  },
};
```

- [ ] **Step 2: Verify the accounts table column names match**

Run: `grep -n "code\|borang_b_section\|is_system\|created_at" apps/api/migrations/*create-accounts*.cjs`
Expected: confirms `code`, `account_type`, `sub_type`, `borang_b_section`, `is_system`, `is_active`, `created_at`, `updated_at` all exist. If the table is `underscored: true` with `timestamps`, the columns are `created_at`/`updated_at` as written. **If they differ, fix the seeder before continuing.**

- [ ] **Step 3: Run the seeder against local dev**

Run:
```bash
docker-compose up -d postgres
cd apps/api && npx sequelize-cli db:seed --seed 20260806000001-non-deductible-account.cjs
```
Expected: no error.

- [ ] **Step 4: Confirm the row exists**

Run: `docker-compose exec -T postgres psql -U pa_user -d personal_accountant -c "SELECT code, name, borang_b_section FROM accounts WHERE code='6995';"`
Expected: one row, `borang_b_section` is empty/NULL.

- [ ] **Step 5: Commit**

```bash
git add apps/api/seeders/20260806000001-non-deductible-account.cjs
git commit -m "feat(gl): add 6995 Non-Deductible Expenses account"
```

---

### Task 2: Pure ledger aggregation helpers

Separating the shaping logic from SQL makes it testable without a database. This is the only task with real unit tests; everything downstream is thin SQL.

**Files:**
- Create: `apps/api/services/ledgerAggregation.js`
- Test: `apps/api/tests/ledgerAggregation.test.js`

**Interfaces:**
- Produces:
  - `CASH_ACCOUNT_CODES: string[]` — `['1000', '1010']`
  - `buildMonthBuckets(from: string, to: string): Record<string, {month: string, income: number, expenses: number, net: number}>` — keys are `YYYY-MM`, zero-filled across the whole range, `month` is a label like `"Jan 25"`.
  - `applyCashRows(buckets, rows): void` — mutates buckets; `rows` are `{month: 'YYYY-MM', inflow: string|number, outflow: string|number}`.
  - `finaliseMonths(buckets): Array<{month, income, expenses, net}>` — sorted ascending by key, `net` computed.
  - `applySectionRules(sectionRows): Record<string, number>` — `sectionRows` are `{section: 'D1'..'D20', amount: string|number}`; returns every Borang B section zero-filled, with D15 halved.
- Consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/ledgerAggregation.test.js`:

```javascript
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
```

The last test needs the shared constant imported into the test file as well:

```javascript
import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && node --test tests/ledgerAggregation.test.js`
Expected: FAIL — cannot find module `../services/ledgerAggregation.js`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/services/ledgerAggregation.js`:

```javascript
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

// Accumulating floats drifts (100.10 + 200.20 + 50.30 === 350.59999999999997),
// so every figure this module returns is rounded to cents at the boundary.
// Accumulation stays full-precision; only the returned value is rounded.
const toCents = (n) => Math.round(n * 100) / 100;

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && node --test tests/ledgerAggregation.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add a test script to package.json**

Add a `test` script to the `scripts` block of `apps/api/package.json`:

```json
    "test": "node --test tests/*.test.js",
```

Note: `node --test tests/` (a bare directory path) does **not** recurse in this
environment — it resolves `tests` as a module and fails. Verified on Node 18,
21, 22 and 23. Use the glob form above.

- [ ] **Step 6: Run via the script**

Run: `cd apps/api && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/services/ledgerAggregation.js apps/api/tests/ledgerAggregation.test.js apps/api/package.json
git commit -m "feat(gl): add pure ledger aggregation helpers with tests"
```

---

### Task 3: Guarantee GL completeness

`JournalEntryService` already has `onExpenseCreated`, `onPaymentReceived` and `onInvoiceSent` written but **never called**. Every controller only posts GL `if (journal_lines?.length)`. Wire the fallbacks into the `else` branch so a record can never exist without a GL entry.

**Files:**
- Modify: `apps/api/services/JournalEntryService.js:166-199` (route non-deductible to 6995)
- Modify: `apps/api/controllers/expensesController.js:48-56`
- Modify: `apps/api/routes/payments.js:55-63`
- Modify: `apps/api/controllers/invoicesController.js:141-150` and `:162-171`

**Interfaces:**
- Consumes: account code `'6995'` from Task 1.
- Produces: the invariant that every `expenses`, `payments` and paid `invoices` row created after this task has a matching `journal_entries` row. Tasks 5-7 depend on this.

- [ ] **Step 1: Route non-deductible expenses to 6995**

In `apps/api/services/JournalEntryService.js`, replace the body of `onExpenseCreated` (currently lines 166-199) with:

```javascript
  async onExpenseCreated(expense) {
    const amount = parseFloat(expense.amount_myr || expense.amount);
    if (amount <= 0) return;

    // The Expense model carries no payment-method field, so expenses always
    // credit the bank account. Cash-paid expenses can be reclassified via a
    // manual journal entry if that ever matters.
    const narration = expense.description || expense.vendor_name || 'Expense';

    // Not claimable against tax → 6995, which carries no Borang B section so
    // GL-sourced tax queries skip it while P&L still reports it.
    let debitAccount;
    if (expense.is_tax_deductible === false) {
      debitAccount = await this.getAccountByCode('6995');
    } else {
      const category = expense.category || (expense.getCategory ? await expense.getCategory() : null);
      debitAccount = category?.borang_b_section
        ? await this.getExpenseAccountBySection(category.borang_b_section)
        : await this.getAccountByCode('6999'); // Other Expenses (D20)
    }

    await this.createAutoEntry({
      entryDate: expense.expense_date,
      description: `Expense: ${expense.vendor_name || 'Unknown vendor'}`,
      lines: [
        { accountId: debitAccount.id, debit: amount, credit: 0, description: narration },
        { accountCode: '1010', debit: 0, credit: amount, description: 'Bank payment' },
      ],
      sourceType: 'expense',
      sourceId: expense.id,
    });
  }
```

- [ ] **Step 2: Confirm `Expense.is_tax_deductible` exists**

Run: `grep -n "is_tax_deductible" apps/api/models/Expense.js`
Expected: `is_tax_deductible: { type: DataTypes.BOOLEAN, defaultValue: true }` on line 16. This flag is what routes an expense to `6995`.

- [ ] **Step 3: Add the expense fallback**

In `apps/api/controllers/expensesController.js`, replace the `if (data.journal_lines?.length) { ... }` block (lines 48-56) with:

```javascript
    // The GL is the source of truth for cash flow, dashboard and tax, so an
    // expense must never exist without an entry. Use the client's reviewed
    // lines when present, otherwise derive them.
    if (data.journal_lines?.length) {
      await JournalEntryService.createAutoEntry({
        entryDate: expense.expense_date,
        description: `Expense: ${expense.vendor_name || 'Unknown vendor'}`,
        lines: data.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
        sourceType: 'expense',
        sourceId: expense.id,
      });
    } else {
      await JournalEntryService.onExpenseCreated(
        await expense.reload({ include: [{ association: 'category' }] }),
      );
    }
```

- [ ] **Step 4: Verify the `category` association name**

Run: `grep -n "as: 'category'" apps/api/models/*.js`
Expected: `Expense.belongsTo(ExpenseCategory, { as: 'category' ... })`. If the alias differs, correct Step 3.

- [ ] **Step 5: Add the payment fallback**

In `apps/api/routes/payments.js`, replace the `if (req.body.journal_lines?.length) { ... }` block (lines 55-63) with:

```javascript
    if (req.body.journal_lines?.length) {
      await JournalEntryService.createAutoEntry({
        entryDate: payment.payment_date,
        description: `Payment received for ${invoice.invoice_number}`,
        lines: req.body.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
        sourceType: 'payment',
        sourceId: payment.id,
      });
    } else {
      await JournalEntryService.onPaymentReceived(payment, invoice);
    }
```

- [ ] **Step 6: Add the invoice markPaid fallback**

In `apps/api/controllers/invoicesController.js`, in `markPaid`, replace the `if (req.body.journal_lines?.length) { ... }` block (lines 162-171) with:

```javascript
    if (req.body.journal_lines?.length) {
      await JournalEntryService.createAutoEntry({
        entryDate: new Date().toISOString().split('T')[0],
        description: `Full payment for ${invoice.invoice_number}`,
        lines: req.body.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
        sourceType: 'payment',
        sourceId: invoice.id,
      });
    } else {
      await JournalEntryService.onPaymentReceived(
        { amount: invoice.total, payment_date: invoice.paid_at || new Date(), method: 'bank_transfer' },
        invoice,
      );
    }
```

- [ ] **Step 7: Add the invoice send fallback**

In `apps/api/controllers/invoicesController.js`, in `send`, replace the `if (req.body.journal_lines?.length) { ... }` block (lines 141-150) with:

```javascript
    if (req.body.journal_lines?.length) {
      await JournalEntryService.createAutoEntry({
        entryDate: invoice.issue_date,
        description: `Invoice ${invoice.invoice_number} issued`,
        lines: req.body.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
        sourceType: 'invoice',
        sourceId: invoice.id,
      });
    } else {
      await JournalEntryService.onInvoiceSent(invoice);
    }
```

- [ ] **Step 8: Manually verify end to end**

Run the API (`cd apps/api && node server.js`), then create an expense through the web UI **without** opening the GL review modal. Then:

```bash
docker-compose exec -T postgres psql -U pa_user -d personal_accountant -c \
  "SELECT e.id, e.vendor_name, je.reference_number FROM expenses e LEFT JOIN journal_entries je ON je.source_type='expense' AND je.source_id=e.id ORDER BY e.id DESC LIMIT 5;"
```
Expected: the newest expense has a non-null `reference_number`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/services/JournalEntryService.js apps/api/controllers/expensesController.js apps/api/routes/payments.js apps/api/controllers/invoicesController.js
git commit -m "fix(gl): always post a journal entry for expenses, payments and invoices"
```

---

### Task 4: Backfill script for historical gaps

Records created before Task 3 may have no GL entry. They would silently vanish once the read surfaces switch. This script reports and repairs them.

**Files:**
- Create: `apps/api/scripts/backfill-journal-entries.js`

**Interfaces:**
- Consumes: `JournalEntryService.onExpenseCreated` / `onPaymentReceived` / `onInvoiceSent` from Task 3.
- Produces: a CLI runnable as `node scripts/backfill-journal-entries.js [--apply]`. Default is dry-run.

- [ ] **Step 1: Write the script**

Create `apps/api/scripts/backfill-journal-entries.js`:

```javascript
/**
 * Reports (and with --apply, repairs) source records that have no posted
 * journal entry. The GL is the source of truth for cash flow, dashboard and
 * tax, so any gap here is a number missing from those screens.
 *
 *   node scripts/backfill-journal-entries.js           # dry run
 *   node scripts/backfill-journal-entries.js --apply   # write entries
 */
// Mirrors server.js: dotenv must run before any model/service import, and ES
// static imports are hoisted, so the model imports below are dynamic.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

const { sequelize, Expense, Payment, Invoice, ExpenseCategory } = await import('../models/index.js');
const { default: JournalEntryService } = await import('../services/JournalEntryService.js');

const APPLY = process.argv.includes('--apply');

async function missingIds(table, sourceType) {
  const [rows] = await sequelize.query(
    `SELECT s.id FROM ${table} s
     LEFT JOIN journal_entries je
       ON je.source_type = :sourceType AND je.source_id = s.id
     WHERE je.id IS NULL
     ORDER BY s.id`,
    { replacements: { sourceType } },
  );
  return rows.map((r) => r.id);
}

async function main() {
  const expenseIds = await missingIds('expenses', 'expense');
  const paymentIds = await missingIds('payments', 'payment');
  const invoiceIds = (await missingIds('invoices', 'invoice')).length;

  console.log(`Expenses without a GL entry: ${expenseIds.length}`);
  console.log(`Payments without a GL entry: ${paymentIds.length}`);
  console.log(`Invoices without an issue entry: ${invoiceIds}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create the missing entries.');
    return;
  }

  let ok = 0;
  const failures = [];

  for (const id of expenseIds) {
    try {
      const expense = await Expense.findByPk(id, { include: [{ model: ExpenseCategory, as: 'category' }] });
      await JournalEntryService.onExpenseCreated(expense);
      ok++;
    } catch (err) { failures.push(`expense ${id}: ${err.message}`); }
  }

  for (const id of paymentIds) {
    try {
      const payment = await Payment.findByPk(id);
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (!invoice) throw new Error('orphaned payment — no invoice');
      await JournalEntryService.onPaymentReceived(payment, invoice);
      ok++;
    } catch (err) { failures.push(`payment ${id}: ${err.message}`); }
  }

  console.log(`\nCreated ${ok} entries.`);
  if (failures.length) {
    console.log(`${failures.length} failed:`);
    failures.forEach((f) => console.log('  ' + f));
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => sequelize.close());
```

- [ ] **Step 2: Confirm the .env path resolves**

`server.js` lives at `apps/api/` and loads `../../.env` (repo root). This script lives one level deeper at `apps/api/scripts/`, hence `../../../.env`.

Run: `ls -la .env` from the repo root.
Expected: the file exists. If the repo root has no `.env`, the script will silently use defaults and fail to connect — create it from `.env.example` first.

- [ ] **Step 3: Run the dry run locally**

Run: `cd apps/api && node scripts/backfill-journal-entries.js`
Expected: three counts printed, no write, exit 0.

- [ ] **Step 4: Apply locally and confirm it is idempotent**

Run:
```bash
cd apps/api && node scripts/backfill-journal-entries.js --apply
node scripts/backfill-journal-entries.js
```
Expected: the second (dry) run reports `0` for expenses and payments.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/backfill-journal-entries.js
git commit -m "feat(gl): add journal entry backfill script with dry-run default"
```

---

### Task 5: LedgerQueryService and GL-sourced cash flow

**Files:**
- Create: `apps/api/services/LedgerQueryService.js`
- Modify: `apps/api/routes/cashFlow.js` (the whole `/actual` handler)
- Modify: `apps/api/services/CashFlowService.js:47-67` and `:93-110`

**Interfaces:**
- Consumes: `ledgerAggregation.js` exports from Task 2.
- Produces:
  - `LedgerQueryService.getCashFlowByMonth(from: string, to: string): Promise<Array<{month, income, expenses, net}>>`
  - `LedgerQueryService.getCashTotals(from: string, to: string): Promise<{income: number, expenses: number}>`
  - `LedgerQueryService.getExpensesBySection(from: string, to: string): Promise<Record<string, number>>`
  - Tasks 6 and 7 consume these.
- The `/cash-flow/actual` response shape is **unchanged**: `{ from, to, monthly: [{month, income, expenses, net}], totals: { totalIncome, totalExpenses, netCashFlow, avgMonthlyNet } }`. The frontend must not need edits.

- [ ] **Step 1: Write the service**

Create `apps/api/services/LedgerQueryService.js`:

```javascript
import { sequelize } from '../models/index.js';
import {
  CASH_ACCOUNT_CODES,
  buildMonthBuckets,
  applyCashRows,
  finaliseMonths,
  applySectionRules,
} from './ledgerAggregation.js';

/** All money questions answered from the general ledger, so every module that
 *  posts an entry (invoices, expenses, payment vouchers) is counted the same. */
class LedgerQueryService {
  async #cashRows(from, to) {
    const [rows] = await sequelize.query(
      `SELECT to_char(je.entry_date, 'YYYY-MM') AS month,
              COALESCE(SUM(jel.debit), 0)  AS inflow,
              COALESCE(SUM(jel.credit), 0) AS outflow
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       JOIN accounts a        ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND je.entry_date BETWEEN :from AND :to
         AND a.code IN (:cashCodes)
       GROUP BY 1`,
      { replacements: { from, to, cashCodes: CASH_ACCOUNT_CODES } },
    );
    return rows;
  }

  async getCashFlowByMonth(from, to) {
    const buckets = buildMonthBuckets(from, to);
    applyCashRows(buckets, await this.#cashRows(from, to));
    return finaliseMonths(buckets);
  }

  async getCashTotals(from, to) {
    const months = await this.getCashFlowByMonth(from, to);
    return {
      income: months.reduce((s, m) => s + m.income, 0),
      expenses: months.reduce((s, m) => s + m.expenses, 0),
    };
  }

  /** Deductible expense totals keyed by Borang B section. Accounts with a NULL
   *  borang_b_section (e.g. 6995 Non-Deductible) are excluded by the WHERE. */
  async getExpensesBySection(from, to) {
    const [rows] = await sequelize.query(
      `SELECT a.borang_b_section AS section,
              COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS amount
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       JOIN accounts a        ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND a.account_type = 'expense'
         AND a.borang_b_section IS NOT NULL
         AND je.entry_date BETWEEN :from AND :to
       GROUP BY 1`,
      { replacements: { from, to } },
    );
    return applySectionRules(rows);
  }
}

export default new LedgerQueryService();
```

- [ ] **Step 2: Rewrite the `/actual` handler**

In `apps/api/routes/cashFlow.js`, replace the entire `router.get('/actual', ...)` handler with:

```javascript
// GET /cash-flow/actual?from=2026-01-01&to=2026-12-31
// Sourced from the general ledger: an inflow is a debit to a cash account and
// an outflow is a credit to one, so invoices, expenses and payment vouchers all
// count. Every month in range is present, zero-filled.
router.get('/actual', async (req, res, next) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const to = req.query.to || new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

    const monthly = await LedgerQueryService.getCashFlowByMonth(from, to);

    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const avgMonthlyNet = monthly.length ? netCashFlow / monthly.length : 0;

    res.json({ from, to, monthly, totals: { totalIncome, totalExpenses, netCashFlow, avgMonthlyNet } });
  } catch (err) { next(err); }
});
```

Then fix the imports at the top of the file — replace the `Invoice, Expense` and `Op` imports with:

```javascript
import LedgerQueryService from '../services/LedgerQueryService.js';
```

Keep the `CashFlowService` import (still used by `/projection`).

- [ ] **Step 3: Update CashFlowService actuals**

In `apps/api/services/CashFlowService.js`, replace the `if (monthEnd < today) { ... }` block (lines 48-67) with:

```javascript
      if (monthEnd < today) {
        const totals = await LedgerQueryService.getCashTotals(
          monthStart.toISOString().split('T')[0],
          monthEnd.toISOString().split('T')[0],
        );
        actualIncome = totals.income;
        actualExpenses = totals.expenses;
      }
```

And replace `getActual` (lines 93-110) with the following. Verified: `getActual` has **no callers anywhere** in `apps/api` or `apps/web` — only `getProjection` is used — so changing its return shape is safe.

```javascript
  async getActual(from, to) {
    const monthly = await LedgerQueryService.getCashFlowByMonth(from, to);
    return {
      totalIncome: monthly.reduce((s, m) => s + m.income, 0),
      totalExpenses: monthly.reduce((s, m) => s + m.expenses, 0),
      monthly,
    };
  }
```

Add to the imports at the top: `import LedgerQueryService from './LedgerQueryService.js';` and drop `Expense` from the models import if it is no longer referenced.

- [ ] **Step 4: Verify against a known PV**

Start the API, log in, then:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/cash-flow/actual?from=2026-01-01&to=2026-12-31" | jq '.totals'
```
Expected: `totalExpenses` now includes the payment voucher amount that was previously missing. Cross-check against:
```bash
docker-compose exec -T postgres psql -U pa_user -d personal_accountant -c \
  "SELECT SUM(jel.credit) FROM journal_entry_lines jel JOIN journal_entries je ON je.id=jel.journal_entry_id JOIN accounts a ON a.id=jel.account_id WHERE a.code IN ('1000','1010') AND je.status='posted' AND je.entry_date BETWEEN '2026-01-01' AND '2026-12-31';"
```
Expected: the two figures match.

- [ ] **Step 5: Commit**

```bash
git add apps/api/services/LedgerQueryService.js apps/api/routes/cashFlow.js apps/api/services/CashFlowService.js
git commit -m "feat(gl): source cash flow from the general ledger"
```

---

### Task 6: GL-sourced dashboard

**Files:**
- Modify: `apps/api/controllers/dashboardController.js:25-40`

**Interfaces:**
- Consumes: `LedgerQueryService.getCashTotals` from Task 5.
- Response shape unchanged: `{ totalIncome, totalExpenses, netProfit, totalOutstanding, invoiceCount, period }`.

- [ ] **Step 1: Rewrite the overview aggregation**

In `apps/api/controllers/dashboardController.js`, replace the `Promise.all([...])` block and the `res.json` in `overview` (lines 25-40) with:

```javascript
    const fromDate = from.toISOString().split('T')[0];
    const toDate = to.toISOString().split('T')[0];

    // Income and expenses come from the ledger so payment vouchers and any
    // other posted entry are included, not just the invoices/expenses tables.
    const [cash, totalOutstanding, invoiceCount] = await Promise.all([
      LedgerQueryService.getCashTotals(fromDate, toDate),
      Invoice.sum('amount_due', { where: { status: { [Op.in]: ['sent', 'overdue'] } } }),
      Invoice.count({ where: { issue_date: { [Op.between]: [fromDate, toDate] } } }),
    ]);

    res.json({
      totalIncome: cash.income,
      totalExpenses: cash.expenses,
      netProfit: cash.income - cash.expenses,
      totalOutstanding: totalOutstanding || 0,
      invoiceCount: invoiceCount || 0,
      period: req.query.period || 'month',
    });
```

Add `import LedgerQueryService from '../services/LedgerQueryService.js';` to the imports.

- [ ] **Step 2: Verify dashboard matches cash flow**

Run both and compare for the same period:
```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/v1/dashboard/overview?period=year" | jq '{totalIncome, totalExpenses}'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/v1/cash-flow/actual" | jq '.totals | {totalIncome, totalExpenses}'
```
Expected: identical figures. Before this change they disagreed whenever a PV existed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/controllers/dashboardController.js
git commit -m "feat(gl): source dashboard totals from the general ledger"
```

---

### Task 7: GL-sourced Borang B expenses

**Files:**
- Modify: `apps/api/services/TaxCalculator.js:29-57`

**Interfaces:**
- Consumes: `LedgerQueryService.getExpensesBySection` from Task 5.
- Produces: `getExpensesBySection(year)` returns `{ sectionTotals }`. **Note the shape change** — it no longer returns `expenses`. Check callers.

- [ ] **Step 1: Find every caller**

Run: `grep -rn "getExpensesBySection" apps/api`
Expected: `TaxCalculator.js:75` (inside `generateBorangBData`, uses only `sectionTotals`) plus the definition. If any caller destructures `expenses`, keep returning it from the `expenses` table for display purposes only.

- [ ] **Step 2: Replace the method**

In `apps/api/services/TaxCalculator.js`, replace `getExpensesBySection` (lines 29-57) with:

```javascript
  /**
   * Deductible expenses grouped by Borang B section, read from the general
   * ledger so payment vouchers and journal entries count alongside expenses.
   * Accounts with no borang_b_section (6995 Non-Deductible) are excluded.
   * D15 Entertainment is halved by applySectionRules.
   */
  async getExpensesBySection(year) {
    const sectionTotals = await LedgerQueryService.getExpensesBySection(
      `${year}-01-01`,
      `${year}-12-31`,
    );
    return { sectionTotals };
  }
```

Add `import LedgerQueryService from './LedgerQueryService.js';` and remove `Expense, ExpenseCategory` from the models import if now unused.

- [ ] **Step 3: Confirm D15 is still halved**

Run: `cd apps/api && npm test`
Expected: PASS — the `applySectionRules` test covering D15 still passes, and it is now the single place the rule lives.

- [ ] **Step 4: Compare before/after against the old query**

Run:
```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/v1/taxation/borang-b?year=2026" | jq '.partD'
```
Cross-check D15 is exactly half its gross ledger total:
```bash
docker-compose exec -T postgres psql -U pa_user -d personal_accountant -c \
  "SELECT a.borang_b_section, SUM(jel.debit)-SUM(jel.credit) FROM journal_entry_lines jel JOIN journal_entries je ON je.id=jel.journal_entry_id JOIN accounts a ON a.id=jel.account_id WHERE je.status='posted' AND a.account_type='expense' AND a.borang_b_section IS NOT NULL AND je.entry_date BETWEEN '2026-01-01' AND '2026-12-31' GROUP BY 1 ORDER BY 1;"
```
Expected: every section matches the API, except D5 (mileage is added on top) and D15 (halved).

- [ ] **Step 5: Commit**

```bash
git add apps/api/services/TaxCalculator.js
git commit -m "feat(gl): source Borang B expense sections from the general ledger"
```

---

### Task 8: Module explainers on Expenses and Payment Vouchers

Jimmy's requirement: a short, precise line under each page title so a non-accounting user knows which module to use. The distinction is *who produces the document*, not the accounting treatment.

**Files:**
- Create: `apps/web/src/components/ModuleIntro.jsx`
- Modify: `apps/web/src/pages/Expenses/index.jsx:93-98`
- Modify: `apps/web/src/pages/PaymentVouchers/index.jsx:59-64`

**Interfaces:**
- Produces: `<ModuleIntro>{children}</ModuleIntro>` — a muted single-paragraph explainer.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/ModuleIntro.jsx`:

```jsx
import React from 'react';

/** One-line plain-language explainer shown under a page title. */
export default function ModuleIntro({ children }) {
  return (
    <p style={{
      margin: '0.25rem 0 0',
      maxWidth: '60ch',
      fontSize: '0.875rem',
      lineHeight: 1.4,
      color: 'var(--cds-text-secondary, #525252)',
    }}>
      {children}
    </p>
  );
}
```

- [ ] **Step 2: Add the explainer to Expenses**

In `apps/web/src/pages/Expenses/index.jsx`, replace the header block (lines 94-98) with:

```jsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Expenses</h1>
          <ModuleIntro>
            Money you spent where <strong>the seller gave you the paperwork</strong> — a receipt,
            bill or supplier invoice. Record it here and attach their document.
          </ModuleIntro>
        </div>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>Add Expense</Button>
      </div>
```

Add the import: `import ModuleIntro from '../../components/ModuleIntro.jsx';`

- [ ] **Step 3: Add the explainer to Payment Vouchers**

In `apps/web/src/pages/PaymentVouchers/index.jsx`, replace the header block (lines 61-64) with:

```jsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, margin: 0 }}>Payment Vouchers</h1>
          <ModuleIntro>
            Money you paid where <strong>you have to produce the paperwork</strong> — typically a
            freelancer or contractor with no invoice to give you. Issue a voucher as the record.
          </ModuleIntro>
        </div>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>New Payment Voucher</Button>
      </div>
```

Add the import: `import ModuleIntro from '../../components/ModuleIntro.jsx';`

- [ ] **Step 4: Build the frontend**

Run: `cd apps/web && npm run build`
Expected: build succeeds, no unresolved import errors.

- [ ] **Step 5: Visually confirm**

Run `cd apps/web && npm run dev`, open `/expenses` and `/payment-vouchers`.
Expected: each title has one muted line beneath it; the action button stays top-right and does not wrap awkwardly at narrow widths.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ModuleIntro.jsx apps/web/src/pages/Expenses/index.jsx apps/web/src/pages/PaymentVouchers/index.jsx
git commit -m "feat(web): explain the Expenses vs Payment Vouchers distinction on each page"
```

---

## Production rollout (do NOT run without Jimmy's explicit go-ahead)

1. Seed the new account: `npx sequelize-cli db:seed --seed 20260806000001-non-deductible-account.cjs`
2. Dry-run the backfill and read the counts: `node scripts/backfill-journal-entries.js`
3. Only if the counts look right, apply: `node scripts/backfill-journal-entries.js --apply`
4. Deploy the API, then confirm dashboard and cash flow agree for the current year.

The backfill writes to production accounting data. It must be dry-run first and the counts reviewed by Jimmy before `--apply`.

---

## Amendment A — Task 3 review findings (ruled by Jimmy, 2026-08-06)

Task 3's review raised three Important findings. Rulings:

1. **`markPaid` stored `source_id = NULL`.** The synthetic payment object passed to
   `onPaymentReceived` had no `id`, so `sourceId: payment.id` resolved to undefined.
   Confirmed live (`JE-202608-0006`). Consequences: `deleteAutoEntriesForSource` can
   never find the entry, and Task 4's backfill would post a duplicate.
   **Ruling: fix** — pass `id: invoice.id`, matching what the `if` branch already stores.

2. **`payments.js:38` writes `payment_method:` but the `Payment` model attribute is
   `method`** (`models/Payment.js:11`). Sequelize silently drops the unknown key, so
   `method` is always the default `'bank_transfer'`. Harmless while `onPaymentReceived`
   was dead code; after Task 3 wired it up, every cash payment posts to `1010` Bank
   instead of `1000` Cash. **Ruling: fix** — write `method:` and keep the destructured
   `payment_method` request field as the client-facing name.

3. **No atomicity between the source write and the GL post.** The source record commits
   first; if the GL post throws, the orphan record this task exists to prevent is created.
   **Ruling: compensating rollback**, not a threaded transaction — `JournalEntryService`
   is shared with the Payment Voucher flow, which already works, and changing its
   signature risks regressing it.

Compensating rollback per site:
- `expensesController.create` — on GL failure, `await expense.destroy()`, then rethrow.
- `payments.js` POST — move the invoice recalculation to **after** a successful GL post,
  so compensation is just `await payment.destroy()`, then rethrow.
- `invoicesController.send` / `markPaid` — capture the prior field values before
  `invoice.update(...)`, restore them on GL failure, then rethrow.
