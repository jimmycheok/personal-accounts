# Payment Voucher (PV) Module — Design Spec

**Date:** 2026-07-23
**Status:** Approved — ready for implementation planning
**Author:** Brainstorming session (Jimmy + Claude)

## 1. Purpose & Scope

Add a **Payment Voucher (PV)** module: a formal, numbered disbursement document that
records money paid out, supports multiple line items, structured payee/payment details,
attachments, a printable PDF, and posts a confirmed double-entry General Ledger (GL) entry
on approval.

The PV **coexists with** the existing Expense module — it does not replace it. Its primary
use case is **paying freelancer salaries**, so the default debit GL account is Salaries
(`6100`, Borang B section **D2**).

### Lifecycle

`Draft → Approved`, with a `Voided` reversal path.

- **Draft** — fully editable, no PV number assigned, no GL impact.
- **Approve** — assigns `PV-YYYYMM-NNNN`, posts the GL entry (after GLReviewModal
  confirmation), and locks the record.
- **Void** — reverses the posted GL entry and marks the PV `voided`. Approved PVs cannot be
  edited or deleted; they must be voided first.

### Out of scope (v1)

- Multi-currency GL (currency is stored, but GL posts entered amounts as MYR).
- A separate payable/AP stage (no `Draft → Approved → Paid` three-state flow).
- Approval routing/multi-user sign-off (single-owner system).

## 2. Data Model

Two new tables. Models use `underscored: true` per repo convention. No new Chart of
Accounts entries are required — the seeded CoA already contains `6100` (Salaries),
`1000` (Cash), and `1010` (Bank).

### `payment_vouchers`

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `pv_number` | STRING(30) UNIQUE, nullable | assigned on approval — `PV-YYYYMM-NNNN` |
| `pv_date` | DATEONLY | voucher date |
| `payee_name` | STRING(200) | |
| `payee_bank_name` | STRING(200), nullable | for record / printout |
| `payee_bank_account` | STRING(100), nullable | |
| `payee_tin` | STRING(50), nullable | |
| `payment_method` | ENUM | `cash`, `bank_transfer`, `duitnow`, `cheque`, `credit_card`, `online_banking`, `other` |
| `payment_reference` | STRING(200), nullable | cheque no. / transfer ref |
| `description` | TEXT, nullable | overall purpose |
| `currency` | STRING(3) default `MYR` | |
| `total_amount` | DECIMAL(15,2) | computed server-side from lines |
| `status` | ENUM(`draft`,`approved`,`voided`) default `draft` | |
| `approved_at` | DATE, nullable | |
| `notes` | TEXT, nullable | |
| `createdAt`, `updatedAt` | | |

### `payment_voucher_lines`

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `payment_voucher_id` | INTEGER FK → `payment_vouchers` | |
| `description` | TEXT | the particular |
| `account_id` | INTEGER FK → `accounts` | debit/expense account; defaults to `6100` Salaries. Carries Borang B section automatically. |
| `amount` | DECIMAL(15,2) | |
| `createdAt`, `updatedAt` | | |

### Associations (`models/index.js`)

```js
PaymentVoucher.hasMany(PaymentVoucherLine, { foreignKey: 'payment_voucher_id', as: 'lines' });
PaymentVoucherLine.belongsTo(PaymentVoucher, { foreignKey: 'payment_voucher_id', as: 'voucher' });
PaymentVoucherLine.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });
```

Migrations use the `.cjs` extension (Sequelize CLI / CJS convention).

## 3. GL Posting

On **Approve**, a balanced journal entry is built:

- **One debit per PV line** → `DR line.account_id` for `line.amount`
  (default account `6100` Salaries / D2).
- **One credit** → `CR 1010` (Bank) or `CR 1000` (Cash), selected from `payment_method`
  (`cash` → `1000`, otherwise `1010`), for `total_amount`.

The proposed lines pre-fill the existing **`GLReviewModal`**, where the user confirms/edits
accounts (with optional AI-suggest) before posting — same UX as invoices and expenses. On
accept, the frontend calls the approve endpoint with the confirmed `journal_lines`. The
controller then:

1. Generates `pv_number`, sets `status = 'approved'`, `approved_at = now`.
2. Calls
   `JournalEntryService.createAutoEntry({ entryDate: pv_date, description: 'Payment Voucher {pv_number} — {payee}', lines, sourceType: 'payment_voucher', sourceId: pv.id })`.

On **Void/Delete**:
`JournalEntryService.deleteAutoEntriesForSource('payment_voucher', pv.id)`.

This reuses `JournalEntryService` exactly as the Expense module does. The server
re-validates that debits equal credits before posting.

### GLReviewModal change

`GLReviewModal` currently keys off a static `DEFAULT_TEMPLATES` map. PV lines are dynamic
(one debit per line), so the modal is enhanced to accept **pre-built initial lines** passed
by the parent, in addition to the static-template path. A `payment_voucher_approve` default
(DR `6100` Salaries / CR bank-or-cash) is added for the single-line fallback case.

## 4. API

`routes/paymentVouchers.js`, all under `verifyJwt`; financial mutations call
`writeAuditLog()`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/payment-vouchers` | list (filter by status, date range, search payee/number) |
| POST | `/payment-vouchers` | create draft (+ lines) |
| GET | `/payment-vouchers/:id` | detail (lines + linked journal entry) |
| PATCH | `/payment-vouchers/:id` | update draft (replaces lines); draft only |
| POST | `/payment-vouchers/:id/approve` | assign number + post GL (accepts confirmed `journal_lines`) |
| POST | `/payment-vouchers/:id/void` | reverse GL, set `voided` |
| DELETE | `/payment-vouchers/:id` | delete draft only |
| GET | `/payment-vouchers/:id/pdf` | printable voucher PDF |

Route mounted at `/api/v1/payment-vouchers` in `app.js`.

### Numbering

`PV-YYYYMM-NNNN`, generated at approval by querying the max `pv_number` for the current
`YYYYMM` (mirrors `JournalEntryService.generateReferenceNumber`). Assigning at approval
(not at draft creation) avoids number gaps from deleted drafts.

## 5. Attachments

`<AttachmentsPanel subjectType="payment_voucher" subjectId={pv.id} />` on the detail page —
reuses the polymorphic `Document` model; no backend changes needed.

In the **create flow**, files are staged in the form and uploaded immediately after the
draft is created (mirroring `AddExpenseModal`'s inline staging), enabling
"input info + attach + create" in one pass.

## 6. Printable PDF

- New template `apps/api/templates/payment-voucher.html`.
- New `PdfService` method → Gotenberg (`/forms/chromium/convert/html`).
- Content: company header, payee & payment details, itemized lines, total, **total in words**
  (a small number-to-words helper), and **Prepared by / Approved by / Received by**
  signature lines.
- Line-item rows are pre-rendered into an HTML fragment before substitution, since
  `PdfService` does not auto-render arrays.

## 7. Frontend

`apps/web/src/pages/PaymentVouchers/`:

- **`index.jsx`** — DataTable (PV #, date, payee, amount, method, status), New button, row
  actions (view / edit-draft / void / delete-draft / PDF).
- **`PaymentVoucherForm.jsx`** — payee + payment fields, line-items table
  (description / account ComboBox from CoA, defaulting to `6100` Salaries / amount) with a
  running total, attachment staging, Save as draft.
- **`PaymentVoucherDetail.jsx`** — read view, **Approve** button (opens GLReviewModal with
  pre-built lines), PDF download, AttachmentsPanel, linked journal entry once approved.

Wiring:
- 4 routes in `apps/web/src/App.jsx` (`/payment-vouchers`, `/new`, `/:id/edit`, `/:id`).
- Sidebar nav item (`Receipt` icon) in `apps/web/src/components/AppShell.jsx`.
- API calls via the shared `apps/web/src/services/api.js` Axios instance.

## 8. Validation & Edge Cases

- Approve requires ≥1 line, each with an account and a positive amount; server re-validates
  DR = CR.
- Approved PVs are immutable — void to reverse; void has no time limit (a PV is not an
  e-invoice).
- Deleting a draft cleans up any staged attachments.
- `total_amount` is always recomputed server-side from lines on create/update/approve.
- v1 assumes MYR.

## 9. Testing

Integration tests matching the existing API test setup:

- Create draft → approve → assert a balanced JournalEntry exists with correct DR/CR,
  `source_type = 'payment_voucher'`, `source_id = pv.id`.
- Void → assert the JournalEntry is removed.
- `pv_number` format `PV-YYYYMM-NNNN` and no gaps across deleted drafts.
- `total_amount` equals the sum of line amounts.
- Draft-only guards on PATCH/DELETE; approved-PV immutability.

## 10. Files Touched (summary)

**API (new):**
- `models/PaymentVoucher.js`, `models/PaymentVoucherLine.js`
- `migrations/*-create-payment-vouchers.cjs`, `migrations/*-create-payment-voucher-lines.cjs`
- `controllers/paymentVouchersController.js`
- `routes/paymentVouchers.js`
- `templates/payment-voucher.html`

**API (modified):**
- `models/index.js` (associations)
- `app.js` (mount route)
- `services/PdfService.js` (PV PDF method)

**Web (new):**
- `pages/PaymentVouchers/index.jsx`, `PaymentVoucherForm.jsx`, `PaymentVoucherDetail.jsx`

**Web (modified):**
- `App.jsx` (routes), `components/AppShell.jsx` (nav), `components/GLReviewModal.jsx`
  (accept pre-built lines + `payment_voucher_approve` default).
