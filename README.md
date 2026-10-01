# Personal Accountant

An all-in-one accounting system built for a single Malaysian sole proprietor. Handles the complete financial lifecycle — from quoting and invoicing through to LHDN MyInvois e-invoice submission and annual Borang B tax preparation.

---

## What it does

### Invoicing & Sales
- Create quotations and convert accepted ones directly into invoices
- Generate professional PDF invoices with embedded DuitNow QR codes for instant payment
- Record partial or full payments; invoices auto-mark as paid when settled
- Duplicate any invoice, expense, mileage entry, or payment voucher — opens a pre-filled create form for quick review before saving
- Issue credit notes linked to original invoices
- Auto-generate sequential invoice/quotation numbers with configurable prefixes

### LHDN MyInvois E-Invoice Compliance
- Submit e-invoices to LHDN in UBL JSON format (mandatory for eligible businesses)
- Submits standard invoices (type `01`) and credit notes (type `02`). Debit note (`03`) and self-billed (`11`) exist in the submission schema but are not yet wired up — see Roadmap
- Consolidated monthly submission for B2C transactions under RM 200 (special buyer TIN `EI00000000010`)
- LHDN QR code embedded on invoice PDF once submission is validated
- Real-time status polling; cancellation supported within LHDN's 72-hour window

### Expense Tracking with OCR
- Upload a receipt photo — GPT-4o Vision extracts vendor, amount, date, and suggests a category automatically
- If confidence is below 70%, a blank manual form is shown instead of a mis-filled one
- 52 pre-seeded expense categories mapped to Borang B sections D1–D20
- Entertainment expenses (D15) are stored at full amount; the 50% deductibility rule is applied automatically at tax calculation time

### Borang B Tax Preparation
- Income (Part B) and deductible expenses by Borang B section (Part D) are both read from the General Ledger, so every module that posts a journal entry — including Payment Vouchers — is counted
- Income is recognised on an **accrual** basis (revenue accounts), not cash received
- Expenses posted to accounts with no Borang B section (e.g. `6995` Non-Deductible Expenses) are excluded from Part D while still appearing in Profit & Loss
- D5 (Motor Vehicle Expenses) is claimed solely from actual vehicle receipts (fuel, repairs, insurance, road tax, parking) recorded in Expenses — the mileage log posts no journal entry and is not a deduction; see "Mileage log" below
- Personal relief inputs (EPF, medical, education, dependants, etc.) applied to arrive at chargeable income
- Progressive tax brackets for AY2024/2025 with a full bracket breakdown
- Exports a formatted Borang B summary PDF ready to hand to your tax agent

### Double-Entry Accounting (v2.0)
- Pre-seeded Chart of Accounts (40 accounts) mapped to Malaysian Borang B sections D1-D20
- General Ledger with automatic journal entry creation for every financial transaction
- GL Review Modal appears before each transaction — pre-fills smart defaults, allows manual account selection, or AI-powered suggestions via Claude
- Profit & Loss report with Revenue, COGS, Gross Profit, Operating Expenses (by Borang B section), and Net Profit — with PDF export
- Balance Sheet report with Assets, Liabilities, Owner's Equity, and automatic balance verification — with PDF export
- Trial Balance report
- Year-end closing automation: closes revenue/expense accounts to Retained Earnings, transfers Owner's Drawings to Capital
- Manual journal entries for adjustments not covered by standard transactions

### Payment Vouchers (v2.3)
- Record outgoing payments (e.g. freelancer salaries) as formal, numbered payment vouchers (`PV-YYYYMM-NNNN`)
- Create from a modal with a free-text **service-item** table (item + amount) and staged file attachments
- On save, the GL Review modal posts a balanced journal entry immediately — defaulting to DR Salaries & Wages (`6100`) / CR the payment-method account (Bank `1010` or Cash `1000`) — and the voucher is marked posted
- Void reverses the journal entry
- Duplicate copies the payee, bank details, description, notes and service items into a new voucher; the date resets to today and the payment reference starts blank. Attachments and the GL entry are not copied
- Downloads a printable PDF voucher (`PV-YYYYMM-NNNN.pdf`) with amount-in-words and a "computer generated, no signature required" note

### GL-Sourced Money Figures (v2.4)
- Cash Flow, the Dashboard and Borang B tax all read the **General Ledger**, not the `expenses`/`invoices` tables — so Payment Vouchers and manual journal entries appear everywhere, consistently
- Cash is defined as accounts `1000` (Cash on Hand) and `1010` (Bank Account): a debit is an inflow, a credit an outflow. Credit Card (`2300`) is a liability, so a card purchase becomes an outflow only when the card is paid
- Every financial write path posts a journal entry unconditionally; if the GL post fails the source record is rolled back rather than left orphaned
- `scripts/backfill-journal-entries.js` reports and repairs records created before this became mandatory (dry-run by default)

### Dashboard & Reporting
- Financial overview: **Cash In, Cash Out, Net Cash** (cash-basis, from the ledger) and outstanding balance — filterable by month, quarter, or year
- Upcoming deadlines: overdue invoices, due-soon invoices, and annual Borang B filing reminder (30 April)
- Cash flow projection: N-month forward view built from outstanding invoices and active recurring templates
- Excel/CSV export for invoices and expenses; JSON backup and restore (covers invoices, expenses, customers, payments and mileage — the ledger tables are not yet included, see Roadmap)

### Supporting Tools
- **Bank reconciliation** — import CSV bank statements and match rows to invoices or expenses
- **Mileage log** — a record and estimate only, not a tax deduction. Track business trips; the app computes `km × rate` (defaulting to RM 0.60/km via `MILEAGE_RATE_PER_KM`, overridable per trip) purely as the owner's own reference estimate — it posts no journal entry and produces no deduction. Vehicle costs are claimed from actual receipts (fuel, repairs, insurance, road tax, parking) recorded in the Expenses module under s.33(1) ITA 1967, with this log serving as the substantiating logbook (see "Malaysian compliance notes" below)
- **Document storage** — attach PDF and image files to any record; in-app preview for images and PDFs; store locally, on AWS S3, or Google Drive
- **Recurring templates** — auto-generate repeating invoices or expenses on a schedule
- **Audit log** — all financial mutations are recorded with before/after snapshots

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + Yarn workspaces |
| Frontend | React 18 + Vite + IBM Carbon Design System v11 |
| Backend | Express.js v5 (ES modules) |
| Database | PostgreSQL 15 (Sequelize v6) |
| Job scheduler | Agenda + MongoDB 7 |
| PDF generation | Gotenberg v8 (Docker) |
| OCR | OpenAI GPT-4o Vision |
| Authentication | JWT (single owner) |
| Encryption | AES-256-CBC (for LHDN credentials at rest) |
| API tests | `node:test` (built in — no test dependency) |
| Browser tests | Playwright (Chromium) |

---

## Repository layout

```
personal-accountant/
├── apps/
│   ├── api/                  # Express.js backend (port 3001)
│   │   ├── server.js         # Entry point (loads env, then imports app.js)
│   │   ├── app.js            # Express app
│   │   ├── config/           # Database, Agenda, storage config
│   │   ├── controllers/      # Request handlers
│   │   ├── jobs/             # Agenda scheduled jobs
│   │   ├── middlewares/      # JWT auth, error handler, audit log
│   │   ├── migrations/       # Sequelize migrations (26 tables)
│   │   ├── models/           # Sequelize models (incl. Account, JournalEntry, JournalEntryLine, PaymentVoucher, PaymentVoucherLine)
│   │   ├── routes/           # Route definitions (22 route files)
│   │   ├── schemas/          # Zod validation schemas
│   │   ├── scripts/          # Operational scripts (backfill-journal-entries.js, remove-mileage-journal-entries.js)
│   │   ├── seeders/          # Expense categories, Chart of Accounts, non-deductible account
│   │   ├── services/         # Business logic (MyInvois, OCR, PDF, tax, GL, LedgerQuery, reports, AI accounting)
│   │   ├── templates/        # HTML templates for Gotenberg PDF (invoice, P&L, balance sheet, payment voucher, tax summary)
│   │   └── tests/            # node:test unit tests for pure helpers
│   │
│   └── web/                  # React frontend (port 5173)
│       ├── e2e/              # Playwright browser tests
│       ├── playwright.config.js
│       └── src/
│           ├── components/   # AppShell, GLReviewModal, AddExpenseModal, PaymentVoucherModal, PaymentModal, ConfirmModal, AttachmentsPanel, OCRAssistantModal, CustomerQuickCreateModal, ModuleIntro
│           ├── context/      # AuthContext, AppSettingsContext
│           ├── pages/        # One folder per route
│           └── services/     # Axios API client with JWT interceptor
│
├── packages/
│   └── shared/               # Constants shared by API and web
│       └── src/constants/
│           ├── borangBMapping.js   # Expense categories → D1–D20
│           ├── taxBrackets.js      # AY2024/2025 progressive brackets
│           ├── msicCodes.js        # MSIC 2008 industry codes
│           └── invoiceStatus.js    # Enum constants
│
├── docs/
│   ├── local-setup.md        # Step-by-step environment setup guide
│   ├── development-plan.md   # Full module breakdown and architecture
│   └── releases/             # Per-release changelogs (vX.Y.md)
│
├── docker-compose.yml        # PostgreSQL, MongoDB, Gotenberg, API, Web
├── CLAUDE.md                 # AI coding assistant guidance
└── .env.example              # All environment variable definitions
```

---

## Screens

| Route | Description |
|---|---|
| `/onboarding` | 4-step first-run wizard (business info, e-invoice, storage, review) |
| `/dashboard` | Financial overview, outstanding invoices, deadlines, cash flow snapshot |
| `/invoices` | Invoice list, create, detail with payment history and e-invoice status |
| `/quotations` | Quotation list + detail page with send/accept/reject/convert actions and attachments |
| `/quotations/:id` | Quotation detail with line items, status actions, and file attachments |
| `/credit-notes` | Credit note issuance and LHDN submission |
| `/credit-notes/:id` | Credit note detail with status actions and file attachments |
| `/expenses` | Expense list with view modal and inline attachment support; AI receipt scan via header |
| `/payment-vouchers` | Payment voucher list; "New Payment Voucher" opens a modal (service items + GL posting on save); row menu Duplicate opens it prefilled |
| `/payment-vouchers/:id` | Voucher detail with service items, linked GL entry, PDF download, void, and attachments |
| `/taxation` | Borang B summary, relief inputs, tax estimate, PDF export |
| `/cash-flow` | Projected vs actual cash flow line chart |
| `/bank-reconciliation` | CSV import and transaction matching |
| `/customers` | Customer CRUD with search and inline quick-create from invoice/quotation forms |
| `/mileage` | Trip log with modal entry form and per-trip detail view |
| `/chart-of-accounts` | Chart of Accounts with type filter, add account, click-through to account ledger |
| `/chart-of-accounts/:id/ledger` | Per-account transaction ledger with running balance |
| `/general-ledger` | Journal entries list with date range and source type filters |
| `/general-ledger/new` | Manual journal entry form with balanced debit/credit validation |
| `/general-ledger/:id` | Journal entry detail with line items |
| `/reports` | Financial reports landing page |
| `/reports/profit-loss` | P&L statement with Borang B grouping, PDF download, year-end close |
| `/reports/balance-sheet` | Balance Sheet with Assets = Liabilities + Equity verification |
| `/documents` | File attachments across all records with in-app image/PDF preview |
| `/settings` | Business profile, e-invoice config, storage, preferences |

---

## Scheduled background jobs

| Job | Schedule | Purpose |
|---|---|---|
| `check-overdue-invoices` | Daily 00:00 | Marks sent invoices past their due date as overdue |
| `generate-recurring-entries` | Daily 06:00 | Creates invoices/expenses from active recurring templates |
| `send-payment-reminders` | Daily 09:00 | Emails customers for invoices 3, 7, and 14 days overdue |
| `poll-einvoice-status` | Every 30 min | Syncs pending LHDN submission statuses |
| `cleanup-temp-files` | Daily 02:00 | Removes multer temp uploads older than 24 hours |

---

## Getting started

**→ [Local Environment Setup Guide](docs/local-setup.md)**

The setup guide covers everything from prerequisites through first login, including:
- Installing Node.js, Yarn, and Docker Desktop
- Generating secure values for `JWT_SECRET` and `AES_SECRET_KEY`
- Starting PostgreSQL, MongoDB, and Gotenberg via Docker Compose
- Running database migrations and seeding expense categories
- Completing the onboarding wizard on first run
- Troubleshooting common issues

**Quick start (if you already have Docker running):**

```bash
git clone <repo-url> personal-accountant
cd personal-accountant

cp .env.example .env
# Edit .env — set JWT_SECRET, AES_SECRET_KEY, ADMIN_PASSWORD, OPENAI_API_KEY

yarn install

docker compose up -d postgres mongodb gotenberg

cd apps/api
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
node --watch server.js
```

Open a second terminal:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in with your `ADMIN_PASSWORD`.

---

## Running the tests

```bash
# API unit tests (node:test — no extra dependency)
cd apps/api && npm test

# Browser end-to-end tests (Playwright, Chromium)
# Starts the API and web dev server automatically; needs Postgres up
# and ADMIN_PASSWORD set in the repo-root .env
cd apps/web && npm run e2e
```

---

## Documentation

| Document | Description |
|---|---|
| [Local Setup Guide](docs/local-setup.md) | Complete step-by-step setup for a fresh clone |
| [Development Plan](docs/development-plan.md) | Module breakdown, architecture decisions, API conventions, spec corrections |
| [CLAUDE.md](CLAUDE.md) | Codebase guidance for AI coding assistants |

## Releases

| Version | Date | Summary |
|---|---|---|
| [v2.7](docs/releases/v2.7.md) | 2026-10-01 | Duplicate payment vouchers from the list; voucher date defaults to the local day, not UTC; voucher lines keep their entry order |
| [v2.6](docs/releases/v2.6.md) | 2026-08-11 | Mileage becomes a logbook only (no journal entry, no deduction); voucher PDF address and signature block fixed; unresolved template placeholders no longer leak into PDFs |
| [v2.5](docs/releases/v2.5.md) | 2026-08-11 | Mileage split to its own D5 account with double-claim detection, corrected the false "LHDN tiered rate" claim, fixed the payment voucher PDF download |
| [v2.4](docs/releases/v2.4.md) | 2026-08-10 | GL-sourced cash flow, dashboard & Borang B tax — Payment Vouchers now appear on every money surface; backfill tool; test suites added |
| [v2.3](docs/releases/v2.3.md) | 2026-07-24 | Payment Voucher module — modal create, service-item lines, GL posting on save, printable PDF |
| [v2.2](docs/releases/v2.2.md) | 2026-03-30 | Document preview modal, PDF/image-only upload constraint, mileage rounding fix |
| [v2.1](docs/releases/v2.1.md) | 2026-03-27 | Duplicate records for invoices/expenses/mileage; aligned the frontend mileage rate to the backend's RM 0.60/km |
| [v2.0](docs/releases/v2.0.md) | 2026-03-27 | Chart of Accounts, General Ledger, P&L, Balance Sheet, AI-powered GL suggestions |
| [v1.3](docs/releases/v1.3.md) | 2026-03-18 | Code quality, shared tax constants & minor fixes |
| [v1.2](docs/releases/v1.2.md) | 2026-02-27 | Modal forms, detail pages, polymorphic attachments & 14 bug fixes |
| v1.1 | 2026-02-20 | Docker build, env loading, bank reconciliation refactor, UI fixes |
| v1.0 | 2026-02-10 | Initial release |

---

## Malaysian compliance notes

- **LHDN MyInvois**: Sandbox environment available for testing at `https://preprod-api.myinvois.hasil.gov.my`. Production credentials are configured through the app UI (Settings → E-Invoice), not the `.env` file.
- **Borang B**: Tax calculations use AY2024/2025 progressive brackets (0%–30%). Tax bracket data lives in `packages/shared/src/constants/taxBrackets.js` and must be updated when LHDN announces changes.
- **Mileage**: LHDN publishes no per-km mileage rate for a sole proprietor's business deduction. The RM0.60/km-tiered-to-RM0.30-after-200km figure sometimes quoted as "the LHDN mileage rate" is the Malaysian civil service rate (Pekeliling Perbendaharaan) for government staff claiming official travel — it does not apply to private businesses or the self-employed. For a sole proprietor the statutory basis is **actual costs apportioned by business use** under s.33(1) ITA 1967 (fuel, repairs, insurance, road tax, parking), substantiated by a logbook — there is no per-km shortcut. Accordingly, the Mileage log is a **record and estimate only**: it posts no journal entry and produces no deduction. The app's `km × rate` figure (default RM 0.60/km via `MILEAGE_RATE_PER_KM`, overridable per trip) is the owner's own reasonable estimate, kept for reference and as the logbook substantiating the actual-cost claim. The deduction itself comes solely from actual vehicle receipts recorded in Expenses, which post to D5 (Motor Vehicle Expenses).
- **GST/SST**: The system supports per-line tax rates on invoices. No hard-coded tax rate — the business owner sets the applicable rate per line item.
- **Currency**: All financial records store the original currency and exchange rate alongside an `amount_myr` field for reporting. Reporting and Borang B calculations use the MYR value.

---

## Roadmap

- [ ] Include the ledger tables (`accounts`, `journal_entries`, `journal_entry_lines`, `payment_vouchers`) in the JSON backup — since v2.4 these hold the money figures
- [ ] Wire up debit note (`03`) and self-billed (`11`) e-invoice submission
- [ ] Capital allowance handling for fixed assets (`is_capital_allowance` is stored but not applied)
- [ ] Recurring expense management UI (backend already scaffolded)
- [ ] Audit trail viewer page (`audit_logs` table is populated, no UI yet)
- [ ] Live MYR exchange rates via a public API (currently manual input)
- [ ] Invoice delivery by email with PDF attachment
- [ ] Read-only customer portal for invoice viewing
- [ ] Multi-currency General Ledger support
