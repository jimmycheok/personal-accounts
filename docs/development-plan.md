# Development Plan

Personal Accountant — Malaysian Sole Proprietor Accounting System

---

## Project Goal

An all-in-one accounting system for a single Malaysian sole proprietor with revenue under RM 300,000/year. Covers the full financial workflow: quoting → invoicing → payment collection → expense tracking → LHDN e-invoice compliance → annual Borang B tax preparation.

Built for a single owner-operator — no multi-user, no payroll, no Sdn Bhd features.

---

## Tech Stack Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo | Turborepo + Yarn workspaces | Shared constants between API and web without publishing to npm |
| API | Express.js v5 | Lightweight, familiar, async-friendly |
| ORM | Sequelize v6 | Mature, JSONB support on PostgreSQL |
| PDF | Gotenberg v8 + chromiumly | Full HTML/CSS fidelity for invoices; no layout constraints of pdf-lib |
| Job scheduler | Agenda + MongoDB | Persistent job state survives server restarts unlike node-cron |
| UI | IBM Carbon Design System v11 | Professional, accessible, data-dense components suited for accounting |
| OCR | OpenAI GPT-4o Vision | Best-in-class structured extraction from Malaysian receipts |
| Auth | JWT (single owner) | No user management overhead; one password |
| AES encryption | AES-256-CBC | LHDN client_secret stored encrypted at rest in DB |

---

## Module Breakdown

### Module 00 — System Foundation
Core infrastructure that everything else builds on.

**Deliverables:**
- Turborepo monorepo with `apps/` and `packages/` workspaces
- Docker Compose: PostgreSQL 15, MongoDB 7, Gotenberg 8
- `packages/shared/` — Malaysian tax constants (Borang B mapping, tax brackets, MSIC codes)
- JWT authentication (single owner)
- Sequelize migrations for all 21 tables
- `apps/api/` Express app with middleware (verifyJwt, errorHandler, auditLog)

**Key files:** `docker-compose.yml`, `apps/api/app.js`, `apps/api/models/index.js`, `apps/api/middlewares/`

---

### Module 01 — Onboarding & Settings
First-run experience and ongoing system configuration.

**Deliverables:**
- 4-step onboarding wizard (Carbon `ProgressIndicator`)
  - Step 1: Business Info — name, SSM number, TIN, MSIC code, address, bank account
  - Step 2: E-Invoice Setup — LHDN MyInvois credentials, sandbox/prod toggle, test connection
  - Step 3: Storage — local / Google Drive / AWS S3 selection
  - Step 4: Review & Launch
- Settings page with 4 tabs: Business Profile, E-Invoice Config, Storage Config, Preferences
- `GET /onboarding/status` — used by the web app to gate access until setup is complete
- LHDN `client_secret` stored AES-256-CBC encrypted in `einvoice_configs.client_secret_enc`

**Key files:** `apps/web/src/pages/Onboarding/`, `apps/api/routes/settings.js`, `apps/api/services/MyInvoisService.js` (encrypt/decrypt)

---

### Module 02 — Invoice Management

**Sales flow:** Quotation → (optional accept) → Invoice → Payment

**Deliverables:**
- Quotation CRUD + send / accept / reject / convert-to-invoice / PDF
- Invoice CRUD + send / mark-paid / void / duplicate / PDF
- Line items with per-line tax rate and discount rate; totals auto-calculated
- Payment recording (`POST /invoices/:id/payments`) — auto-marks invoice `paid` when fully settled
- Credit Notes — issue against a paid invoice, linked to original invoice
- DuitNow QR on invoice PDF (EMVCo format, CRC-16 checksum)
- Auto-generated sequential invoice/quotation numbers with configurable prefix (INV-, QUO-)

**Key files:** `apps/api/controllers/invoicesController.js`, `apps/api/routes/quotations.js`, `apps/api/routes/payments.js`, `apps/api/services/DuitNowService.js`

---

### Module 03 — Expense Tracking with OCR

**Deliverables:**
- Expense CRUD with category, date, amount, currency, exchange rate
- Split-panel UI: left = OCR upload chatbot, right = expense table
- OCR flow:
  1. User uploads receipt image via `POST /expenses/ocr`
  2. GPT-4o Vision extracts: vendor, amount, date, category_suggestion, confidence (0–100)
  3. If confidence ≥ 70 → pre-fills expense form
  4. If confidence < 70 → shows blank manual form
- 52 system expense categories pre-seeded, each mapped to Borang B section (D1–D20)
- Entertainment (D15) tracked at full amount; 50% deductibility applied at tax calculation time, not data entry

**Key files:** `apps/api/services/OcrService.js`, `apps/api/controllers/expensesController.js`, `apps/web/src/pages/Expenses/`, `packages/shared/src/constants/borangBMapping.js`

---

### Module 04 — LHDN MyInvois E-Invoicing

LHDN mandates e-invoice for businesses above the revenue threshold. This module handles all submission types.

**Deliverables:**
- OAuth2 client_credentials token management — token cached in DB, refreshed 5 min before 60-min expiry
- UBL JSON document builder for all 4 submission types:
  - `01` — Standard Invoice (B2B, B2G)
  - `02` — Credit Note
  - `03` — Debit Note
  - `11` — Self-billed Invoice (when supplier cannot issue)
- Document submission → LHDN returns `submissionUID` and `documentUID`
- Status polling — `valid` status stores `longId` on the invoice (used as LHDN QR on PDF)
- Cancellation — only allowed within 72 hours of `valid` status
- Consolidated monthly submission — batches all B2C transactions < RM200 into one document using buyer TIN `EI00000000010`
- TIN validation endpoint — `POST /customers/validate-tin`
- Sandbox: `https://preprod-api.myinvois.hasil.gov.my` | Production: `https://api.myinvois.hasil.gov.my`

**Key files:** `apps/api/services/MyInvoisService.js`, `apps/api/models/EinvoiceSubmission.js`, `apps/api/models/ConsolidatedSubmission.js`, `apps/api/routes/einvoice.js`

---

### Module 05 — Document Storage

**Deliverables:**
- Polymorphic `documents` table — `subject_type` + `subject_id` links to any record (invoice, expense, etc.)
- Strategy pattern with three backends:
  - **Local**: files stored at `uploads/{type}/{year}/{month}/{uuid}.ext`
  - **AWS S3**: same path structure as S3 key, presigned download URLs
  - **Google Drive**: uploaded to `/PersonalAccountant/{type}/{year}/` folder
- Upload via `POST /documents` (multer, 10MB limit)
- Download via `GET /documents/:id/download`
- Storage usage reporting via `GET /documents/storage-usage`
- Active storage backend read from `storage_configs` table at runtime

**Key files:** `apps/api/services/StorageService.js`, `apps/api/models/Document.js`, `apps/api/routes/documents.js`

---

### Module 06 — Taxation (Borang B)

**Deliverables:**
- `TaxCalculator.generateBorangBData(year)`:
  - **Part B**: Sum all paid invoices for the tax year
  - **Part D**: Group expenses by `borang_b_section` (D1–D20); D15 auto-applied at 50%
  - Mileage logs aggregated and added to D5 (Motor Vehicle) at RM 0.25/km
- `TaxCalculator.estimateTax(year, reliefs)`: applies personal relief inputs to arrive at chargeable income, then runs through progressive brackets
- Malaysian AY2024/2025 progressive brackets: 0% → 1% → 3% → 6% → 11% → 19% → 25% → 26% → 28% → 30%
- Taxation page: Borang B summary with all D1–D20 line items, personal relief accordion inputs, live tax estimate
- Tax summary PDF via Gotenberg (`templates/tax-summary.html`)

**Key files:** `apps/api/services/TaxCalculator.js`, `packages/shared/src/constants/taxBrackets.js`, `apps/web/src/pages/Taxation/`

---

### Module 07 — Dashboard

**Deliverables:**
- Financial overview tiles: Revenue, Expenses, Net Profit, Outstanding balance (period-filterable: month/quarter/year)
- Outstanding invoices table (sent + overdue)
- Upcoming deadlines: overdue invoices, due-soon invoices, annual Borang B filing deadline (30 April)
- Recent transactions feed (invoices + expenses merged, sorted by date)
- Tax estimate widget (current year)
- Cash flow snapshot (next 3 months)

**Key files:** `apps/api/controllers/dashboardController.js`, `apps/web/src/pages/Dashboard/`

---

### Module 08 — Settings
Covered within Module 01 (settings page with 4 tabs). Separate Agenda job (`poll-einvoice-status`) handles ongoing status sync.

---

### Module 09 — Bank Reconciliation

**Deliverables:**
- CSV bank statement import (`POST /bank-reconciliation/import`) — parses columns: date, description, debit, credit, balance
- Manual matching: `PUT /bank-reconciliation/:id/rows/:rowId` — link a row to an invoice or expense
- Auto-match: `POST /bank-reconciliation/:id/auto-match` — matches by amount and date proximity
- Reconciliation status tracked per row (`is_reconciled`) and per statement (`import_status`)

**Key files:** `apps/api/routes/bankReconciliation.js`, `apps/api/models/BankStatement.js`, `apps/api/models/BankStatementRow.js`

---

### Module 10 — Mileage Tracking

**Deliverables:**
- Mileage log CRUD (date, from, to, purpose, km)
- Rate: RM 0.25/km (LHDN-approved deductible rate)
- `deductible_amount` auto-calculated on save
- Annual summary: `GET /mileage/summary?year=` — total km and total deduction
- Deduction flows into Borang B Part D, section D5 via `TaxCalculator`

**Key files:** `apps/api/routes/mileage.js`, `apps/api/models/MileageLog.js`, `apps/web/src/pages/Mileage/`

---

### Module 11 — Cash Flow Projection

**Deliverables:**
- `CashFlowService.getProjection(months)` — projects N months forward using:
  - Outstanding invoices (by `due_date`)
  - Active recurring invoice templates (expected income)
  - Active recurring expense templates (expected costs)
- Historical actuals filled in for past months (paid invoices + expenses)
- Results persisted to `cash_flow_projections` table (upserted by `projection_date`)
- Agenda job refreshes projections monthly
- Line chart UI (recharts) with projected vs actual income and expenses

**Key files:** `apps/api/services/CashFlowService.js`, `apps/web/src/pages/CashFlow/`, `apps/api/models/CashFlowProjection.js`

---

### Module 12 — Data Export

**Deliverables:**
- `GET /export/invoices?format=csv|xlsx` — all invoices with customer and line item detail
- `GET /export/expenses?format=csv|xlsx` — all expenses with category and Borang B section
- `GET /export/full-backup` — full JSON dump of all financial data
- `POST /export/restore` — restore from JSON backup

**Key files:** `apps/api/routes/export.js`

---

## Scheduled Jobs (Agenda + MongoDB)

| Job | Schedule | What it does |
|---|---|---|
| `check-overdue-invoices` | Daily 00:00 | Bulk-updates `sent` invoices past `due_date` to `overdue` |
| `generate-recurring-entries` | Daily 06:00 | Creates invoices/expenses from active `recurring_templates` due today; advances `next_run_date` |
| `send-payment-reminders` | Daily 09:00 | Emails customers for invoices 3, 7, and 14 days overdue |
| `poll-einvoice-status` | Every 30 min | Polls LHDN for up to 50 `pending` submissions |
| `cleanup-temp-files` | Daily 02:00 | Deletes multer temp uploads older than 24 hours |

---

## Database Schema Overview

### Configuration
`business_profiles` → `einvoice_configs` → `storage_configs`

### Sales pipeline
`customers` → `quotations` → `quotation_items`
`customers` → `invoices` → `invoice_items`
`invoices` → `payments`
`invoices` → `credit_notes` → `einvoice_submissions`
`invoices` → `einvoice_submissions`
`consolidated_submissions` (standalone monthly batch)

### Expenses
`expense_categories` (self-referential parent_id) → `expenses`

### Supporting
`documents` (polymorphic subject_type/subject_id)
`recurring_templates` (JSONB template_data)
`bank_statements` → `bank_statement_rows`
`mileage_logs`
`audit_logs` (append-only)
`cash_flow_projections`

---

## v1.0 Feature Scope

### In scope (implemented)
- [x] Turborepo monorepo + Docker Compose (Postgres, MongoDB, Gotenberg)
- [x] JWT auth (single owner), AES-256 credential encryption
- [x] 4-step onboarding wizard + full settings page
- [x] Customer management
- [x] Quotations → convert to Invoice
- [x] Invoice CRUD + PDF (Gotenberg) + DuitNow QR + payment recording
- [x] Credit Notes (LHDN compliant, type 02)
- [x] Expense tracking with OCR chatbot (GPT-4o Vision, split-panel UI)
- [x] Document storage (local + Google Drive + S3, polymorphic)
- [x] LHDN MyInvois: standard e-invoice submission + status tracking
- [x] LHDN MyInvois: self-billed e-invoice (type 11)
- [x] LHDN MyInvois: consolidated monthly e-invoice (B2C < RM200)
- [x] LHDN MyInvois: credit note submission (type 02)
- [x] Borang B taxation: income summary + expense summary (D1–D20) + calculator + PDF
- [x] Cash flow projection (N-month forward view)
- [x] Dashboard (financial overview, outstanding invoices, tax widget, upcoming deadlines)
- [x] Bank reconciliation (CSV import + manual + auto matching)
- [x] Mileage tracking (RM 0.25/km)
- [x] Excel/CSV export + full JSON backup/restore
- [x] Audit log writes (all financial mutations)
- [x] Agenda scheduled jobs (5 jobs)

### v1.1 backlog (deferred)
- [ ] Recurring expense UI (schema + Agenda job already scaffolded)
- [ ] Audit trail viewer page (data exists in `audit_logs`, no UI)
- [ ] Live MYR exchange rates (currently manual input)
- [ ] Email invoice delivery (nodemailer configured for reminders; sending PDF as attachment not yet done)
- [ ] Customer portal link (read-only invoice view without login)

---

## API Conventions

- Base path: `/api/v1/`
- All routes protected by `Authorization: Bearer <JWT>` except `POST /auth/login` and `GET /health`
- Errors: `{ error: "message" }` or `{ error: "Validation error", details: [...] }` for Zod failures
- Pagination: `?page=1&limit=50` → response includes `{ total, page, limit, <resource>s: [] }`
- Financial amounts: stored as `DECIMAL(15,2)` in PostgreSQL, returned as strings by Sequelize — always `parseFloat()` before arithmetic
- Dates: stored as `DATEONLY` (YYYY-MM-DD strings), timestamps as `DATE`
- All models use `underscored: true` — JS `camelCase` ↔ DB `snake_case`
