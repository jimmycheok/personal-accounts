# Payment Voucher Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a formal, numbered Payment Voucher (PV) module that records a disbursement with multiple line items, attachments, a printable PDF, and posts a confirmed double-entry GL entry on approval (default debit = Salaries `6100`, credit = Bank `1010` / Cash `1000` by method).

**Architecture:** Mirrors the existing Expense + Invoice patterns. A `PaymentVoucher` has many `PaymentVoucherLine`s (each with an expense/GL `account_id` + amount). Draft PVs carry no number and no GL impact. Approving generates `PV-YYYYMM-NNNN`, posts a balanced entry via the existing `JournalEntryService.createAutoEntry` (confirmed through the existing `GLReviewModal`), and locks the record. Voiding reverses the GL via `JournalEntryService.deleteAutoEntriesForSource`. Attachments reuse the polymorphic `Document` model (`subject_type='payment_voucher'`).

**Tech Stack:** Express v5 (ESM), Sequelize v6 (PostgreSQL), Sequelize CLI migrations (`.cjs`), React 18 + Vite + IBM Carbon, Gotenberg (PDF via `PdfService`).

---

## Testing approach (read first)

This repo has **no automated test framework** (no jest/vitest config, no test scripts, no test files). Introducing one is out of scope for this feature. Each backend task is therefore verified with **concrete curl calls against the running dev API** (with expected output) plus **SQL checks** for GL correctness; frontend tasks are verified in the browser. This matches how the codebase is currently verified.

**Prerequisites for every verification step** (run once at the start of execution):

```bash
# 1. Infra up
docker-compose up -d postgres mongodb gotenberg minio

# 2. API running in a separate terminal (from apps/api/)
cd apps/api && node --watch server.js   # http://localhost:3001

# 3. Get a JWT for curl (default password from ADMIN_PASSWORD env, e.g. changeme123)
export TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"changeme123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
echo "$TOKEN"   # should print a JWT
```

A helper for SQL checks (adjust container name if different):

```bash
# psql into the postgres container; DB name/user per docker-compose (personal_accountant / postgres)
alias pg='docker-compose exec -T postgres psql -U postgres -d personal_accountant -c'
```

---

## Task 1: Database migrations (two tables)

**Files:**
- Create: `apps/api/migrations/20260723000001-create-payment-vouchers.cjs`
- Create: `apps/api/migrations/20260723000002-create-payment-voucher-lines.cjs`

- [ ] **Step 1: Write the payment_vouchers migration**

Create `apps/api/migrations/20260723000001-create-payment-vouchers.cjs`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_vouchers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      pv_number: { type: Sequelize.STRING(30), allowNull: true, unique: true },
      pv_date: { type: Sequelize.DATEONLY, allowNull: false },
      payee_name: { type: Sequelize.STRING(200), allowNull: false },
      payee_bank_name: { type: Sequelize.STRING(200), allowNull: true },
      payee_bank_account: { type: Sequelize.STRING(100), allowNull: true },
      payee_tin: { type: Sequelize.STRING(50), allowNull: true },
      payment_method: {
        type: Sequelize.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'),
        allowNull: false,
        defaultValue: 'bank_transfer',
      },
      payment_reference: { type: Sequelize.STRING(200), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'MYR' },
      total_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('draft', 'approved', 'voided'),
        allowNull: false,
        defaultValue: 'draft',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('payment_vouchers', ['status']);
    await queryInterface.addIndex('payment_vouchers', ['pv_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_vouchers');
    // Clean up ENUM types created by Postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_vouchers_payment_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_vouchers_status";');
  },
};
```

- [ ] **Step 2: Write the payment_voucher_lines migration**

Create `apps/api/migrations/20260723000002-create-payment-voucher-lines.cjs`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_voucher_lines', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      payment_voucher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'payment_vouchers', key: 'id' },
        onDelete: 'CASCADE',
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onDelete: 'RESTRICT',
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('payment_voucher_lines', ['payment_voucher_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_voucher_lines');
  },
};
```

- [ ] **Step 3: Run the migrations**

Run: `cd apps/api && npx sequelize-cli db:migrate`
Expected: output ends with `== 20260723000002-create-payment-voucher-lines: migrated`

- [ ] **Step 4: Verify tables exist**

Run: `docker-compose exec -T postgres psql -U postgres -d personal_accountant -c "\d payment_vouchers" -c "\d payment_voucher_lines"`
Expected: both table structures print, `payment_vouchers.status` is an enum with `draft/approved/voided`, `payment_voucher_lines.payment_voucher_id` FK present.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/20260723000001-create-payment-vouchers.cjs apps/api/migrations/20260723000002-create-payment-voucher-lines.cjs
git commit -m "feat(pv): add payment_vouchers and payment_voucher_lines migrations"
```

---

## Task 2: Sequelize models + associations

**Files:**
- Create: `apps/api/models/PaymentVoucher.js`
- Create: `apps/api/models/PaymentVoucherLine.js`
- Modify: `apps/api/models/index.js` (imports, associations, exports)

- [ ] **Step 1: Write the PaymentVoucher model**

Create `apps/api/models/PaymentVoucher.js`:

```js
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class PaymentVoucher extends Model {}

PaymentVoucher.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pv_number: { type: DataTypes.STRING(30), allowNull: true, unique: true },
  pv_date: { type: DataTypes.DATEONLY, allowNull: false },
  payee_name: { type: DataTypes.STRING(200), allowNull: false },
  payee_bank_name: { type: DataTypes.STRING(200) },
  payee_bank_account: { type: DataTypes.STRING(100) },
  payee_tin: { type: DataTypes.STRING(50) },
  payment_method: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'),
    allowNull: false,
    defaultValue: 'bank_transfer',
  },
  payment_reference: { type: DataTypes.STRING(200) },
  description: { type: DataTypes.TEXT },
  currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  total_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('draft', 'approved', 'voided'), defaultValue: 'draft' },
  approved_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'payment_vouchers',
  timestamps: true,
  underscored: true,
});

export default PaymentVoucher;
```

- [ ] **Step 2: Write the PaymentVoucherLine model**

Create `apps/api/models/PaymentVoucherLine.js`:

```js
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class PaymentVoucherLine extends Model {}

PaymentVoucherLine.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payment_voucher_id: { type: DataTypes.INTEGER, allowNull: false },
  account_id: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'payment_voucher_lines',
  timestamps: true,
  underscored: true,
});

export default PaymentVoucherLine;
```

- [ ] **Step 3: Wire imports, associations, and exports in `models/index.js`**

In `apps/api/models/index.js`, add these two imports after the `JournalEntryLine` import (around line 28):

```js
import PaymentVoucher from './PaymentVoucher.js';
import PaymentVoucherLine from './PaymentVoucherLine.js';
```

Add these associations just before the `export {` block (after line 72):

```js
// Payment Vouchers
PaymentVoucher.hasMany(PaymentVoucherLine, { foreignKey: 'payment_voucher_id', as: 'lines' });
PaymentVoucherLine.belongsTo(PaymentVoucher, { foreignKey: 'payment_voucher_id', as: 'voucher' });
PaymentVoucherLine.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });
Account.hasMany(PaymentVoucherLine, { foreignKey: 'account_id', as: 'paymentVoucherLines' });
```

Add both names to the `export { ... }` list (after `JournalEntryLine,`):

```js
  PaymentVoucher,
  PaymentVoucherLine,
```

- [ ] **Step 4: Verify models load without error**

Run: `cd apps/api && node -e "import('./models/index.js').then(m => console.log('OK', !!m.PaymentVoucher, !!m.PaymentVoucherLine)).catch(e => { console.error(e); process.exit(1); })"`
Expected: `OK true true`

- [ ] **Step 5: Commit**

```bash
git add apps/api/models/PaymentVoucher.js apps/api/models/PaymentVoucherLine.js apps/api/models/index.js
git commit -m "feat(pv): add PaymentVoucher and PaymentVoucherLine models"
```

---

## Task 3: Controller

**Files:**
- Create: `apps/api/controllers/paymentVouchersController.js`

This controller depends on the routes/PDF in later tasks; the `pdf` export references `PdfService.generatePaymentVoucherPdf` (added in Task 6) and `BusinessProfile`. Both exist by execution time only after Task 6 — so the `pdf` handler is written now but first exercised in Task 6's verification.

- [ ] **Step 1: Write the controller**

Create `apps/api/controllers/paymentVouchersController.js`:

```js
import { Op } from 'sequelize';
import {
  sequelize,
  PaymentVoucher,
  PaymentVoucherLine,
  Account,
  JournalEntry,
  JournalEntryLine,
  Document,
  BusinessProfile,
} from '../models/index.js';
import { writeAuditLog } from '../middlewares/auditLog.js';
import JournalEntryService from '../services/JournalEntryService.js';
import PdfService from '../services/PdfService.js';
import StorageService from '../services/StorageService.js';

// PV-YYYYMM-NNNN, assigned at approval
async function getNextPvNumber(date) {
  const d = new Date(date);
  const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const pattern = `PV-${yyyymm}-%`;
  const last = await PaymentVoucher.findOne({
    where: { pv_number: { [Op.like]: pattern } },
    order: [['pv_number', 'DESC']],
  });
  let seq = 1;
  if (last) {
    const parts = last.pv_number.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `PV-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

function computeTotal(lines) {
  return (lines || []).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
}

const LINE_INCLUDE = { model: PaymentVoucherLine, as: 'lines', include: [{ model: Account, as: 'account' }] };

export async function list(req, res, next) {
  try {
    const { status, from, to, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from && to) where.pv_date = { [Op.between]: [from, to] };
    if (search) {
      where[Op.or] = [
        { payee_name: { [Op.iLike]: `%${search}%` } },
        { pv_number: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const { count, rows } = await PaymentVoucher.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ vouchers: rows, total: count, page: parseInt(page) });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { lines = [], ...data } = req.body;
    const total = computeTotal(lines);
    const voucher = await PaymentVoucher.create(
      { ...data, status: 'draft', pv_number: null, total_amount: total },
      { transaction: t },
    );
    if (lines.length) {
      await PaymentVoucherLine.bulkCreate(
        lines.map(l => ({
          payment_voucher_id: voucher.id,
          account_id: l.account_id,
          description: l.description || null,
          amount: parseFloat(l.amount) || 0,
        })),
        { transaction: t },
      );
    }
    await t.commit();
    await writeAuditLog({ action: 'create', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { include: [LINE_INCLUDE] });
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    const journalEntry = await JournalEntry.findOne({
      where: { source_type: 'payment_voucher', source_id: voucher.id },
      include: [{ model: JournalEntryLine, as: 'lines', include: [{ model: Account, as: 'account' }] }],
    });
    res.json({ ...voucher.toJSON(), journalEntry });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { transaction: t });
    if (!voucher) { await t.rollback(); return res.status(404).json({ error: 'Payment voucher not found' }); }
    if (voucher.status !== 'draft') {
      await t.rollback();
      return res.status(409).json({ error: 'Only draft vouchers can be edited' });
    }
    const { lines, ...data } = req.body;
    if (Array.isArray(lines)) {
      await PaymentVoucherLine.destroy({ where: { payment_voucher_id: voucher.id }, transaction: t });
      await PaymentVoucherLine.bulkCreate(
        lines.map(l => ({
          payment_voucher_id: voucher.id,
          account_id: l.account_id,
          description: l.description || null,
          amount: parseFloat(l.amount) || 0,
        })),
        { transaction: t },
      );
      data.total_amount = computeTotal(lines);
    }
    await voucher.update(data, { transaction: t });
    await t.commit();
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.json(full);
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { include: [LINE_INCLUDE] });
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    if (voucher.status !== 'draft') return res.status(409).json({ error: 'Voucher is not a draft' });
    if (!voucher.lines?.length) return res.status(400).json({ error: 'Voucher has no line items' });

    const journalLines = req.body.journal_lines;
    if (!Array.isArray(journalLines) || journalLines.length < 2) {
      return res.status(400).json({ error: 'journal_lines (at least 2) are required to approve' });
    }

    const pvNumber = await getNextPvNumber(voucher.pv_date);

    // createAutoEntry re-validates DR = CR and throws if unbalanced
    await JournalEntryService.createAutoEntry({
      entryDate: voucher.pv_date,
      description: `Payment Voucher ${pvNumber} — ${voucher.payee_name}`,
      lines: journalLines.map(l => ({
        accountId: l.account_id,
        debit: parseFloat(l.debit || 0),
        credit: parseFloat(l.credit || 0),
        description: l.description || null,
      })),
      sourceType: 'payment_voucher',
      sourceId: voucher.id,
    });

    await voucher.update({ pv_number: pvNumber, status: 'approved', approved_at: new Date() });
    await writeAuditLog({ action: 'approve', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.json(full);
  } catch (err) { next(err); }
}

export async function voidVoucher(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    if (voucher.status !== 'approved') return res.status(409).json({ error: 'Only approved vouchers can be voided' });
    await JournalEntryService.deleteAutoEntriesForSource('payment_voucher', voucher.id);
    await voucher.update({ status: 'voided' });
    await writeAuditLog({ action: 'void', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.json(full);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    if (voucher.status !== 'draft') return res.status(409).json({ error: 'Only draft vouchers can be deleted' });

    // Clean up any staged attachments
    const docs = await Document.findAll({ where: { subject_type: 'payment_voucher', subject_id: voucher.id } });
    for (const doc of docs) {
      try { await StorageService.delete(doc.storage_path, doc.storage_type); } catch (e) { console.warn('Storage delete failed:', e.message); }
      await doc.destroy();
    }

    await PaymentVoucherLine.destroy({ where: { payment_voucher_id: voucher.id } });
    await voucher.destroy();
    await writeAuditLog({ action: 'delete', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function pdf(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { include: [LINE_INCLUDE] });
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    const business = await BusinessProfile.findOne();
    const buffer = await PdfService.generatePaymentVoucherPdf(voucher.toJSON(), business ? business.toJSON() : {});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${voucher.pv_number || 'payment-voucher-draft'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Verify the controller parses (no runtime call yet)**

Run: `cd apps/api && node -e "import('./controllers/paymentVouchersController.js').then(m => console.log('exports:', Object.keys(m).join(','))).catch(e => { console.error(e); process.exit(1); })"`
Expected: `exports: list,create,getById,update,approve,voidVoucher,remove,pdf`

- [ ] **Step 3: Commit**

```bash
git add apps/api/controllers/paymentVouchersController.js
git commit -m "feat(pv): add payment vouchers controller"
```

---

## Task 4: Routes + mount

**Files:**
- Create: `apps/api/routes/paymentVouchers.js`
- Modify: `apps/api/app.js` (import + mount)

- [ ] **Step 1: Write the router**

Create `apps/api/routes/paymentVouchers.js`:

```js
import { Router } from 'express';
import {
  list, create, getById, update, approve, voidVoucher, remove, pdf,
} from '../controllers/paymentVouchersController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.get('/', list);
router.post('/', create);
router.get('/:id', getById);
router.get('/:id/pdf', pdf);
router.put('/:id', update);
router.post('/:id/approve', approve);
router.post('/:id/void', voidVoucher);
router.delete('/:id', remove);

export default router;
```

- [ ] **Step 2: Import and mount in `app.js`**

In `apps/api/app.js`, add the import after line 32 (`import journalEntriesRoutes ...`):

```js
import paymentVouchersRoutes from './routes/paymentVouchers.js';
```

Add the mount after line 84 (`app.use(`${v1}/journal-entries`, journalEntriesRoutes);`):

```js
app.use(`${v1}/payment-vouchers`, paymentVouchersRoutes);
```

- [ ] **Step 3: Restart the API and create a draft PV**

The `node --watch` process reloads automatically. Then:

```bash
curl -s -X POST http://localhost:3001/api/v1/payment-vouchers \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "pv_date":"2026-07-23",
    "payee_name":"Ali Freelancer",
    "payee_bank_name":"Maybank",
    "payee_bank_account":"1234567890",
    "payment_method":"bank_transfer",
    "description":"July design work",
    "lines":[{"account_id":<SALARY_ACCT_ID>,"description":"UI design","amount":1500}]
  }'
```

First fetch the Salaries account id: `curl -s "http://localhost:3001/api/v1/accounts" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const a=JSON.parse(d).find(x=>x.code==='6100');console.log('6100 id:',a&&a.id)})"` and substitute it for `<SALARY_ACCT_ID>`.
Expected: HTTP 201 JSON with `"status":"draft"`, `"pv_number":null`, `"total_amount":"1500.00"`, and a `lines` array of length 1.

- [ ] **Step 4: Verify list and getById**

```bash
curl -s "http://localhost:3001/api/v1/payment-vouchers" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3001/api/v1/payment-vouchers/1" -H "Authorization: Bearer $TOKEN"
```
Expected: list returns `{"vouchers":[...],"total":1,...}`; getById returns the voucher with `lines` (each line has an `account` object) and `"journalEntry":null`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/routes/paymentVouchers.js apps/api/app.js
git commit -m "feat(pv): add payment vouchers routes and mount"
```

---

## Task 5: Approve/void GL posting (verify end-to-end backend)

**Files:** none new — this task exercises Task 3's `approve`/`voidVoucher` and confirms correct GL.

- [ ] **Step 1: Approve the draft with balanced journal lines**

Using the PV id `1`, its total `1500`, the Salaries account id (`<SALARY_ACCT_ID>`, code 6100) and Bank account id (`<BANK_ACCT_ID>`, code 1010 — fetch the same way as Task 4 Step 3):

```bash
curl -s -X POST http://localhost:3001/api/v1/payment-vouchers/1/approve \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"journal_lines":[
    {"account_id":<SALARY_ACCT_ID>,"debit":1500,"credit":0,"description":"UI design"},
    {"account_id":<BANK_ACCT_ID>,"debit":0,"credit":1500,"description":"Payment via bank_transfer"}
  ]}'
```
Expected: HTTP 200 JSON with `"status":"approved"`, `"pv_number":"PV-202607-0001"`, `"approved_at"` set.

- [ ] **Step 2: Verify the GL entry is balanced and linked**

```bash
docker-compose exec -T postgres psql -U postgres -d personal_accountant -c \
"SELECT je.reference_number, je.source_type, je.source_id, je.status,
        SUM(jel.debit) AS dr, SUM(jel.credit) AS cr
 FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
 WHERE je.source_type='payment_voucher' AND je.source_id=1
 GROUP BY je.id;"
```
Expected: one row, `source_type=payment_voucher`, `status=posted`, `dr=1500.00`, `cr=1500.00`.

- [ ] **Step 3: Verify approving again is rejected**

Run the Step 1 curl again.
Expected: HTTP 409 `{"error":"Voucher is not a draft"}`.

- [ ] **Step 4: Void and confirm GL reversal**

```bash
curl -s -X POST http://localhost:3001/api/v1/payment-vouchers/1/void -H "Authorization: Bearer $TOKEN"
docker-compose exec -T postgres psql -U postgres -d personal_accountant -c \
"SELECT COUNT(*) FROM journal_entries WHERE source_type='payment_voucher' AND source_id=1;"
```
Expected: void returns `"status":"voided"`; the count query returns `0` (GL entry removed).

- [ ] **Step 5: Verify unbalanced approve is rejected (regression guard)**

Create a fresh draft (Task 4 Step 3), then approve it with deliberately unbalanced lines (e.g. debit 1500 / credit 1000).
Expected: HTTP 500 with an error message containing `not balanced` (thrown by `JournalEntryService`); the voucher remains `draft` with `pv_number:null` (verify via getById). No PV number is consumed because the number is assigned only after `createAutoEntry` succeeds.

> Note: approve assigns the number *after* `createAutoEntry` succeeds, so a rejected (unbalanced) approve leaves the draft numberless and re-approvable. This is intentional.

- [ ] **Step 6: Commit (no code change — checkpoint only)**

No commit needed; this task is verification of Tasks 3–4. If Step 5 revealed the number was assigned before posting, fix `approve` so `getNextPvNumber` is only persisted after `createAutoEntry` resolves, then commit that fix.

---

## Task 6: Printable PDF

**Files:**
- Create: `apps/api/templates/payment-voucher.html`
- Modify: `apps/api/services/PdfService.js` (add `numberToWords` helper + `generatePaymentVoucherPdf`)

- [ ] **Step 1: Create the HTML template**

Create `apps/api/templates/payment-voucher.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #161616; margin: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #161616; padding-bottom: 12px; }
  .biz-name { font-size: 18px; font-weight: 700; }
  .doc-title { font-size: 20px; font-weight: 700; text-align: right; }
  .meta { margin-top: 16px; width: 100%; }
  .meta td { padding: 3px 6px; vertical-align: top; }
  .meta .label { color: #6f6f6f; width: 130px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 20px; }
  table.lines th { background: #f4f4f4; text-align: left; padding: 8px; border-bottom: 2px solid #e0e0e0; }
  table.lines td { padding: 8px; border-bottom: 1px solid #e0e0e0; }
  .amt { text-align: right; }
  .total-row td { font-weight: 700; border-top: 2px solid #161616; }
  .words { margin-top: 12px; font-style: italic; }
  .sigs { display: flex; justify-content: space-between; margin-top: 60px; }
  .sig { width: 30%; text-align: center; }
  .sig .line { border-top: 1px solid #161616; padding-top: 6px; color: #6f6f6f; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="biz-name">{{business.business_name}}</div>
      <div>{{business.address}}</div>
      <div>{{business.phone}}</div>
    </div>
    <div>
      <div class="doc-title">PAYMENT VOUCHER</div>
      <div style="text-align:right;">{{voucher.pv_number}}</div>
    </div>
  </div>

  <table class="meta">
    <tr><td class="label">Date</td><td>{{voucher.pv_date}}</td>
        <td class="label">Status</td><td>{{voucher.status}}</td></tr>
    <tr><td class="label">Pay To</td><td>{{voucher.payee_name}}</td>
        <td class="label">Method</td><td>{{voucher.payment_method}}</td></tr>
    <tr><td class="label">Bank</td><td>{{voucher.payee_bank_name}}</td>
        <td class="label">Account No.</td><td>{{voucher.payee_bank_account}}</td></tr>
    <tr><td class="label">Reference</td><td>{{voucher.payment_reference}}</td>
        <td class="label">TIN</td><td>{{voucher.payee_tin}}</td></tr>
  </table>

  <table class="lines">
    <thead>
      <tr><th>Description</th><th>Account</th><th class="amt">Amount ({{voucher.currency}})</th></tr>
    </thead>
    <tbody>
      <!-- PV line rows rendered dynamically -->
    </tbody>
    <tfoot>
      <tr class="total-row"><td colspan="2" class="amt">Total</td><td class="amt">{{voucher.total_display}}</td></tr>
    </tfoot>
  </table>

  <div class="words">Ringgit Malaysia: {{voucher.amount_in_words}}</div>

  <div class="sigs">
    <div class="sig"><div class="line">Prepared by</div></div>
    <div class="sig"><div class="line">Approved by</div></div>
    <div class="sig"><div class="line">Received by</div></div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Add the number-to-words helper and PDF method in `PdfService.js`**

In `apps/api/services/PdfService.js`, add this helper function at module scope (after the `renderItemsHtml` function, before `class PdfService`):

```js
function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function under1000(n) {
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) s += ' '; }
    if (n >= 20) { s += tens[Math.floor(n / 10)]; n %= 10; if (n) s += '-' + ones[n]; }
    else if (n > 0) { s += ones[n]; }
    return s;
  }

  const num = Math.floor(Math.abs(Number(amount) || 0));
  const cents = Math.round((Math.abs(Number(amount) || 0) - num) * 100);

  let words = '';
  if (num === 0) {
    words = 'Zero';
  } else {
    const scales = [['Million', 1000000], ['Thousand', 1000]];
    let remaining = num;
    for (const [name, value] of scales) {
      if (remaining >= value) {
        words += under1000(Math.floor(remaining / value)) + ' ' + name + ' ';
        remaining %= value;
      }
    }
    if (remaining > 0) words += under1000(remaining);
  }

  words = words.trim();
  let result = words;
  if (cents > 0) result += ` and Cents ${under1000(cents)}`;
  return `${result} Only`;
}
```

Then add this method inside the `PdfService` class (after `generateCreditNotePdf`, before `generateProfitLossPdf`):

```js
  async generatePaymentVoucherPdf(voucher, business) {
    const currency = voucher.currency || 'MYR';
    const total = Number(voucher.total_amount || 0);
    const data = {
      voucher: {
        ...voucher,
        total_display: `${currency} ${total.toFixed(2)}`,
        amount_in_words: numberToWords(total),
      },
      business: business || {},
    };
    let html = renderTemplate('payment-voucher.html', data);

    const linesHtml = (voucher.lines || []).map(l => {
      const desc = String(l.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const acct = l.account ? `${l.account.code} — ${l.account.name}` : '';
      return `<tr>
        <td>${desc}</td>
        <td>${acct}</td>
        <td class="amt">${currency} ${Number(l.amount || 0).toFixed(2)}</td>
      </tr>`;
    }).join('\n');
    html = html.replace('<!-- PV line rows rendered dynamically -->', linesHtml);

    return htmlToPdf(html);
  }
```

- [ ] **Step 3: Generate a PDF for an approved voucher**

Approve a fresh draft first (Task 5 Step 1 flow). Then:

```bash
curl -s "http://localhost:3001/api/v1/payment-vouchers/<APPROVED_ID>/pdf" \
  -H "Authorization: Bearer $TOKEN" -o /tmp/pv.pdf
file /tmp/pv.pdf
```
Expected: `/tmp/pv.pdf: PDF document, version 1.x`. Open it and confirm it shows the payee, the line item(s), the total, "Ringgit Malaysia: One Thousand Five Hundred Only", and the three signature lines.

- [ ] **Step 4: Sanity-check the words helper directly**

Run: `cd apps/api && node -e "import('./services/PdfService.js').then(async () => {}); const w=(await import('./services/PdfService.js')); console.log('loaded', typeof w.default.generatePaymentVoucherPdf);"`
Expected: `loaded function` (confirms the method is exported on the singleton).

- [ ] **Step 5: Commit**

```bash
git add apps/api/templates/payment-voucher.html apps/api/services/PdfService.js
git commit -m "feat(pv): add printable payment voucher PDF"
```

---

## Task 7: GLReviewModal — accept pre-built lines + PV default template

**Files:**
- Modify: `apps/web/src/components/GLReviewModal.jsx`

The PV has dynamic debit lines (one per line item), so the modal must accept `initialLines` from the parent. When provided, they seed the table instead of the static template. A `payment_voucher_approve` template is also added for the single-line fallback (default DR `6100` Salaries / CR `1010` Bank).

- [ ] **Step 1: Add the PV template**

In `apps/web/src/components/GLReviewModal.jsx`, add to the `DEFAULT_TEMPLATES` object (after the `mileage_create` line, ~line 29):

```js
  payment_voucher_approve: [{ code: '6100', side: 'debit' }, { code: '1010', side: 'credit' }],
```

- [ ] **Step 2: Accept and honour the `initialLines` prop**

Change the component signature (line 81) from:

```js
export default function GLReviewModal({ open, type, data, onAccept, onCancel }) {
```

to:

```js
export default function GLReviewModal({ open, type, data, initialLines, onAccept, onCancel }) {
```

Then replace the "Build default lines when modal opens" effect (lines 96–104) with a version that prefers `initialLines`:

```js
  // Seed lines when the modal opens.
  // Prefer caller-supplied initialLines (dynamic PV lines); otherwise build from the template.
  useEffect(() => {
    if (!open || !type) return;
    setError('');
    setExplanation('');
    if (initialLines?.length) {
      setLines(initialLines);
      return;
    }
    if (data && accounts.length > 0) {
      setLines(buildDefaultLines(type, data, accounts));
    }
  }, [open, type, accounts.length]);
```

- [ ] **Step 3: Verify the web app builds**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors (`dist/` produced). A warning about chunk size is acceptable; a compile error is not.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/GLReviewModal.jsx
git commit -m "feat(pv): let GLReviewModal accept pre-built lines + PV template"
```

---

## Task 8: Payment Voucher list page

**Files:**
- Create: `apps/web/src/pages/PaymentVouchers/index.jsx`

- [ ] **Step 1: Write the list page**

Create `apps/web/src/pages/PaymentVouchers/index.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import {
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  TableContainer, TableToolbar, TableToolbarContent, TableToolbarSearch,
  Button, Tag, Pagination, OverflowMenu, OverflowMenuItem, InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const STATUS_TAG = { draft: 'gray', approved: 'green', voided: 'red' };

export default function PaymentVouchersPage() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const load = () => {
    api.get('/payment-vouchers', { params: { search: search || undefined, limit: 500 } })
      .then(res => setVouchers(res.data.vouchers || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load payment vouchers'));
  };

  useEffect(() => { load(); }, [search]);

  const handleDelete = async (id) => {
    try { await api.delete(`/payment-vouchers/${id}`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Delete failed'); }
  };

  const rows = vouchers.map(v => ({
    id: String(v.id),
    pv_number: v.pv_number || '(draft)',
    pv_date: v.pv_date,
    payee_name: v.payee_name,
    total_amount: `RM ${Number(v.total_amount || 0).toFixed(2)}`,
    payment_method: v.payment_method,
    status: v.status,
  }));

  const headers = [
    { key: 'pv_number', header: 'PV No.' },
    { key: 'pv_date', header: 'Date' },
    { key: 'payee_name', header: 'Payee' },
    { key: 'total_amount', header: 'Amount' },
    { key: 'payment_method', header: 'Method' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: '' },
  ];

  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 400 }}>Payment Vouchers</h1>
        <Button renderIcon={Add} onClick={() => navigate('/payment-vouchers/new')}>New Payment Voucher</Button>
      </div>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <DataTable rows={paged} headers={headers} isSortable>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch onChange={(e) => setSearch(e?.target?.value || '')} placeholder="Search payee or PV number" persistent />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(header => {
                    const { key, ...rest } = getHeaderProps({ header });
                    return <TableHeader key={header.key} {...rest}>{header.header}</TableHeader>;
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => {
                  const v = vouchers.find(x => String(x.id) === row.id);
                  return (
                    <TableRow key={row.id} onClick={() => navigate(`/payment-vouchers/${row.id}`)} style={{ cursor: 'pointer' }}>
                      {row.cells.map(cell => {
                        if (cell.info.header === 'status') {
                          return <TableCell key={cell.id}><Tag type={STATUS_TAG[v.status] || 'gray'}>{v.status}</Tag></TableCell>;
                        }
                        if (cell.info.header === 'actions') {
                          return (
                            <TableCell key={cell.id} onClick={(e) => e.stopPropagation()}>
                              <OverflowMenu flipped aria-label="Actions">
                                <OverflowMenuItem itemText="View" onClick={() => navigate(`/payment-vouchers/${row.id}`)} />
                                {v.status === 'draft' && <OverflowMenuItem itemText="Edit" onClick={() => navigate(`/payment-vouchers/${row.id}/edit`)} />}
                                {v.status === 'draft' && <OverflowMenuItem isDelete itemText="Delete" onClick={() => handleDelete(row.id)} />}
                              </OverflowMenu>
                            </TableCell>
                          );
                        }
                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        page={page} pageSize={pageSize} pageSizes={[10, 25, 50]} totalItems={rows.length}
        onChange={({ page, pageSize }) => { setPage(page); setPageSize(pageSize); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/PaymentVouchers/index.jsx
git commit -m "feat(pv): add payment vouchers list page"
```

---

## Task 9: Payment Voucher form page (create/edit + attachment staging)

**Files:**
- Create: `apps/web/src/pages/PaymentVouchers/PaymentVoucherForm.jsx`

- [ ] **Step 1: Write the form page**

Create `apps/web/src/pages/PaymentVouchers/PaymentVoucherForm.jsx`:

```jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  TextInput, TextArea, Select, SelectItem, DatePicker, DatePickerInput,
  ComboBox, Button, InlineNotification, InlineLoading, Tag,
} from '@carbon/react';
import { Add, TrashCan, Upload } from '@carbon/icons-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';

const METHODS = ['cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'];
const SALARY_CODE = '6100';

const EMPTY_LINE = () => ({ account_id: '', description: '', amount: '' });

export default function PaymentVoucherForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    pv_date: new Date().toISOString().slice(0, 10),
    payee_name: '', payee_bank_name: '', payee_bank_account: '', payee_tin: '',
    payment_method: 'bank_transfer', payment_reference: '', description: '', notes: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Load accounts; default new lines to the Salaries account (6100)
  useEffect(() => {
    api.get('/accounts').then(res => {
      const accts = res.data || [];
      setAccounts(accts);
      if (!isEdit) {
        const salary = accts.find(a => a.code === SALARY_CODE);
        if (salary) setLines([{ account_id: salary.id, description: '', amount: '' }]);
      }
    }).catch(console.error);
  }, []);

  // Load existing voucher in edit mode
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/payment-vouchers/${id}`).then(res => {
      const v = res.data;
      if (v.status !== 'draft') { setError('Only draft vouchers can be edited.'); return; }
      setForm({
        pv_date: v.pv_date,
        payee_name: v.payee_name || '', payee_bank_name: v.payee_bank_name || '',
        payee_bank_account: v.payee_bank_account || '', payee_tin: v.payee_tin || '',
        payment_method: v.payment_method, payment_reference: v.payment_reference || '',
        description: v.description || '', notes: v.notes || '',
      });
      setLines((v.lines || []).map(l => ({ account_id: l.account_id, description: l.description || '', amount: String(l.amount) })));
    }).catch(err => setError(err.response?.data?.error || 'Failed to load voucher'));
  }, [id]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const updateLine = (idx, key, val) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  const addLine = () => setLines(p => [...p, EMPTY_LINE()]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));

  const stageFiles = (e) => { setStagedFiles(p => [...p, ...Array.from(e.target.files || [])]); e.target.value = ''; };
  const removeStaged = (idx) => setStagedFiles(p => p.filter((_, i) => i !== idx));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const handleSubmit = async () => {
    if (!form.payee_name) { setError('Payee name is required'); return; }
    const clean = lines.filter(l => l.account_id && Number(l.amount) > 0);
    if (!clean.length) { setError('At least one line with an account and a positive amount is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, lines: clean.map(l => ({ account_id: l.account_id, description: l.description, amount: Number(l.amount) })) };
      let voucherId = id;
      if (isEdit) {
        await api.put(`/payment-vouchers/${id}`, payload);
      } else {
        const res = await api.post('/payment-vouchers', payload);
        voucherId = res.data.id;
      }
      // Upload staged attachments
      for (const file of stagedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('subject_type', 'payment_voucher');
        fd.append('subject_id', String(voucherId));
        await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      navigate(`/payment-vouchers/${voucherId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment voucher');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        {isEdit ? 'Edit Payment Voucher' : 'New Payment Voucher'}
      </h1>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <DatePicker datePickerType="single" value={new Date(form.pv_date)}
          onChange={([d]) => { if (d) setForm(p => ({ ...p, pv_date: format(d, 'yyyy-MM-dd') })); }}>
          <DatePickerInput id="pv-date" labelText="Voucher Date" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <Select id="pv-method" labelText="Payment Method" value={form.payment_method} onChange={set('payment_method')}>
          {METHODS.map(m => <SelectItem key={m} value={m} text={m.replace('_', ' ')} />)}
        </Select>
        <TextInput id="pv-payee" labelText="Payee Name *" value={form.payee_name} onChange={set('payee_name')} />
        <TextInput id="pv-ref" labelText="Payment Reference" value={form.payment_reference} onChange={set('payment_reference')} placeholder="Cheque no. / transfer ref" />
        <TextInput id="pv-bank" labelText="Payee Bank" value={form.payee_bank_name} onChange={set('payee_bank_name')} />
        <TextInput id="pv-acct" labelText="Payee Bank Account" value={form.payee_bank_account} onChange={set('payee_bank_account')} />
        <TextInput id="pv-tin" labelText="Payee TIN" value={form.payee_tin} onChange={set('payee_tin')} />
      </div>

      <TextInput id="pv-desc" labelText="Description" value={form.description} onChange={set('description')} style={{ marginBottom: '1rem' }} />

      {/* Line items */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Line Items</h2>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={addLine}>Add Line</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f4f4f4', borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem', width: '40%' }}>Account</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', width: '35%' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '0.5rem', width: '18%' }}>Amount (RM)</th>
            <th style={{ width: '7%' }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <ComboBox id={`pv-line-acct-${idx}`} items={accounts}
                  itemToString={item => item ? `${item.code} — ${item.name}` : ''}
                  selectedItem={accounts.find(a => a.id === line.account_id) || null}
                  onChange={({ selectedItem }) => updateLine(idx, 'account_id', selectedItem?.id || '')}
                  placeholder="Select account" titleText="" hideLabel size="sm" />
              </td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <TextInput id={`pv-line-desc-${idx}`} labelText="" hideLabel size="sm"
                  value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Particulars" />
              </td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <TextInput id={`pv-line-amt-${idx}`} labelText="" hideLabel type="number" step="0.01" size="sm"
                  value={line.amount} onChange={e => updateLine(idx, 'amount', e.target.value)} placeholder="0.00" />
              </td>
              <td style={{ textAlign: 'center' }}>
                <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly
                  onClick={() => removeLine(idx)} disabled={lines.length <= 1} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #161616' }}>
            <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>RM {total.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Attachments */}
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Attachments {stagedFiles.length > 0 && `(${stagedFiles.length})`}</h2>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={stageFiles} />
          <Button kind="ghost" size="sm" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>Attach File</Button>
        </div>
        {stagedFiles.length === 0
          ? <p style={{ fontSize: '0.8125rem', color: '#6f6f6f', fontStyle: 'italic' }}>No attachments — files upload when the voucher is saved.</p>
          : stagedFiles.map((file, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f4f4f4', borderRadius: '4px', marginBottom: '0.375rem' }}>
              <Tag type="gray" size="sm">FILE</Tag>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly onClick={() => removeStaged(idx)} />
            </div>
          ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Button kind="secondary" onClick={() => navigate('/payment-vouchers')} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <InlineLoading description="Saving..." /> : 'Save as Draft'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/PaymentVouchers/PaymentVoucherForm.jsx
git commit -m "feat(pv): add payment voucher form page with attachment staging"
```

---

## Task 10: Payment Voucher detail page (approve via GLReviewModal, PDF, void, attachments)

**Files:**
- Create: `apps/web/src/pages/PaymentVouchers/PaymentVoucherDetail.jsx`

- [ ] **Step 1: Write the detail page**

Create `apps/web/src/pages/PaymentVouchers/PaymentVoucherDetail.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import {
  Button, Tag, InlineNotification, StructuredListWrapper, StructuredListHead,
  StructuredListRow, StructuredListCell, StructuredListBody,
} from '@carbon/react';
import { Checkmark, Document as DocumentIcon, Close, Edit } from '@carbon/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import GLReviewModal from '../../components/GLReviewModal.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_TAG = { draft: 'gray', approved: 'green', voided: 'red' };
const BANK_CODE = '1010';
const CASH_CODE = '1000';

export default function PaymentVoucherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [showGL, setShowGL] = useState(false);

  const load = () => {
    api.get(`/payment-vouchers/${id}`)
      .then(res => setVoucher(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load voucher'));
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api.get('/accounts').then(res => setAccounts(res.data || [])).catch(console.error); }, []);

  // Build the debit lines (one per PV line) + the credit (bank/cash) line for the GL modal
  const buildInitialLines = () => {
    if (!voucher) return [];
    const debitLines = (voucher.lines || []).map(l => ({
      account_id: l.account_id,
      account_code: l.account?.code || '',
      account_name: l.account?.name || '',
      debit: Number(l.amount) || 0,
      credit: 0,
      description: l.description || '',
    }));
    const payCode = voucher.payment_method === 'cash' ? CASH_CODE : BANK_CODE;
    const payAcct = accounts.find(a => a.code === payCode);
    return [
      ...debitLines,
      {
        account_id: payAcct?.id || '',
        account_code: payAcct?.code || payCode,
        account_name: payAcct?.name || '',
        debit: 0,
        credit: Number(voucher.total_amount) || 0,
        description: `Payment via ${voucher.payment_method}`,
      },
    ];
  };

  const handleApprove = async (journalLines) => {
    setShowGL(false);
    if (!journalLines?.length) return; // "Skip GL" not allowed for approval
    try {
      await api.post(`/payment-vouchers/${id}/approve`, { journal_lines: journalLines });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    }
  };

  const handleVoid = async () => {
    try { await api.post(`/payment-vouchers/${id}/void`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Void failed'); }
  };

  const openPdf = () => window.open(`${api.defaults.baseURL}/payment-vouchers/${id}/pdf`, '_blank');

  if (!voucher) {
    return <div>{error ? <InlineNotification kind="error" title={error} /> : 'Loading...'}</div>;
  }

  const field = (label, value) => (
    <div><div style={{ fontSize: '0.75rem', color: '#6f6f6f' }}>{label}</div><div>{value || '—'}</div></div>
  );

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400 }}>{voucher.pv_number || 'Payment Voucher (Draft)'}</h1>
          <Tag type={STATUS_TAG[voucher.status] || 'gray'}>{voucher.status}</Tag>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {voucher.status === 'draft' && <Button kind="secondary" renderIcon={Edit} onClick={() => navigate(`/payment-vouchers/${id}/edit`)}>Edit</Button>}
          {voucher.status === 'draft' && <Button renderIcon={Checkmark} onClick={() => setShowGL(true)}>Approve &amp; Post GL</Button>}
          {voucher.status === 'approved' && <Button kind="secondary" renderIcon={DocumentIcon} onClick={openPdf}>PDF</Button>}
          {voucher.status === 'approved' && <Button kind="danger--tertiary" renderIcon={Close} onClick={handleVoid}>Void</Button>}
        </div>
      </div>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1.5rem', border: '1px solid #e0e0e0' }}>
        {field('Date', voucher.pv_date)}
        {field('Payee', voucher.payee_name)}
        {field('Method', voucher.payment_method)}
        {field('Reference', voucher.payment_reference)}
        {field('Bank', voucher.payee_bank_name)}
        {field('Bank Account', voucher.payee_bank_account)}
        {field('TIN', voucher.payee_tin)}
        {field('Total', `RM ${Number(voucher.total_amount || 0).toFixed(2)}`)}
      </div>

      <StructuredListWrapper style={{ background: '#fff' }}>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Description</StructuredListCell>
            <StructuredListCell head>Account</StructuredListCell>
            <StructuredListCell head style={{ textAlign: 'right' }}>Amount (RM)</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          {(voucher.lines || []).map(l => (
            <StructuredListRow key={l.id}>
              <StructuredListCell>{l.description || '—'}</StructuredListCell>
              <StructuredListCell>{l.account ? `${l.account.code} — ${l.account.name}` : ''}</StructuredListCell>
              <StructuredListCell style={{ textAlign: 'right' }}>{Number(l.amount || 0).toFixed(2)}</StructuredListCell>
            </StructuredListRow>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>

      {voucher.journalEntry && (
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6f6f6f' }}>
          Posted to GL: <strong>{voucher.journalEntry.reference_number}</strong>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <AttachmentsPanel subjectType="payment_voucher" subjectId={voucher.id} />
      </div>

      <GLReviewModal
        open={showGL}
        type="payment_voucher_approve"
        data={{ amount: voucher.total_amount, payee_name: voucher.payee_name, method: voucher.payment_method }}
        initialLines={buildInitialLines()}
        onAccept={handleApprove}
        onCancel={() => setShowGL(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/PaymentVouchers/PaymentVoucherDetail.jsx
git commit -m "feat(pv): add payment voucher detail page with approve/void/PDF"
```

---

## Task 11: Wire routes + sidebar navigation

**Files:**
- Modify: `apps/web/src/App.jsx` (imports + routes)
- Modify: `apps/web/src/components/AppShell.jsx` (nav item)

- [ ] **Step 1: Add imports in `App.jsx`**

In `apps/web/src/App.jsx`, add after line 33 (`import BalanceSheetPage ...`):

```jsx
import PaymentVouchersPage from './pages/PaymentVouchers/index.jsx';
import PaymentVoucherFormPage from './pages/PaymentVouchers/PaymentVoucherForm.jsx';
import PaymentVoucherDetailPage from './pages/PaymentVouchers/PaymentVoucherDetail.jsx';
```

- [ ] **Step 2: Add routes in `App.jsx`**

In the inner `<Routes>` block, add after the `/expenses` route (line 65). Order matters: `/new` before `/:id`.

```jsx
              <Route path="/payment-vouchers" element={<PaymentVouchersPage />} />
              <Route path="/payment-vouchers/new" element={<PaymentVoucherFormPage />} />
              <Route path="/payment-vouchers/:id/edit" element={<PaymentVoucherFormPage />} />
              <Route path="/payment-vouchers/:id" element={<PaymentVoucherDetailPage />} />
```

- [ ] **Step 3: Add the sidebar nav item in `AppShell.jsx`**

In `apps/web/src/components/AppShell.jsx`, `navItems` array, add after the `Expenses` entry (line 58). Reuse the already-imported `Notebook` icon (or `Receipt`):

```jsx
    { label: 'Payment Vouchers', path: '/payment-vouchers', icon: Notebook },
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Full manual smoke test in the browser**

Start the web dev server: `cd apps/web && npm run dev`. With the API running and logged in:

1. Click **Payment Vouchers** in the sidebar → list page loads.
2. Click **New Payment Voucher** → the first line item already defaults to `6100 — Salaries`. Fill payee "Ali Freelancer", method "bank_transfer", one line "UI design" / 1500. Attach a PDF. Click **Save as Draft**.
3. Redirects to the detail page showing status **draft**, the line, and the attached file in the Attachments panel.
4. Click **Approve & Post GL** → GLReviewModal opens pre-filled with DR 6100 Salaries 1500 and CR 1010 Bank 1500, showing **Balanced**. Click **Accept & Proceed**.
5. Detail now shows status **approved**, a `PV-YYYYMM-0001` number, and "Posted to GL: JE-...".
6. Click **PDF** → a voucher PDF opens with payee, line, total, amount in words, signature lines.
7. Click **Void** → status becomes **voided**; re-open and confirm no GL reference remains.

Expected: every step behaves as described; no console errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.jsx apps/web/src/components/AppShell.jsx
git commit -m "feat(pv): wire payment voucher routes and sidebar nav"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Multiple line items → Tasks 1–2 (`payment_voucher_lines`), Task 9 (form), Task 3 (create/update).
- GL Review Modal account picking → Task 7 (`initialLines`), Task 10 (approve flow).
- Draft → Approved/Posted + Voided → Task 3 (`approve`/`voidVoucher`), Task 5 (verification).
- Credit bank/cash by method → Task 10 (`buildInitialLines`), Task 7 default template.
- Default Salaries `6100` → Task 7 template, Task 9 form default line.
- Structured payee + payment details → Tasks 1–2 fields, Task 9 form.
- Attachments during create → Task 9 staging, Task 10 AttachmentsPanel.
- Printable PDF with amount-in-words + signatures → Task 6.
- Numbering `PV-YYYYMM-NNNN` at approval → Task 3 `getNextPvNumber`.
- Validation/edge cases (draft-only edit/delete, DR=CR, void cleanup) → Task 3, verified Task 5.

**Type/name consistency:** endpoint paths, field names (`payee_name`, `total_amount`, `payment_method`, `pv_number`), `subject_type='payment_voucher'`, and the `journal_lines` approve payload are consistent across controller, routes, and all three pages.

**Placeholder scan:** `<SALARY_ACCT_ID>`, `<BANK_ACCT_ID>`, `<APPROVED_ID>` in verification steps are runtime values with explicit fetch commands provided — not code placeholders.
