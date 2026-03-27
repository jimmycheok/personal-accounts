# Personal Accountant

An all-in-one accounting system built for a single Malaysian sole proprietor. Handles the complete financial lifecycle — from quoting and invoicing through to LHDN MyInvois e-invoice submission and annual Borang B tax preparation.

---

## What it does

### Invoicing & Sales
- Create quotations and convert accepted ones directly into invoices
- Generate professional PDF invoices with embedded DuitNow QR codes for instant payment
- Record partial or full payments; invoices auto-mark as paid when settled
- Duplicate any invoice, expense, or mileage entry — opens a pre-filled create form for quick review before saving
- Issue credit notes linked to original invoices
- Auto-generate sequential invoice/quotation numbers with configurable prefixes

### LHDN MyInvois E-Invoice Compliance
- Submit e-invoices to LHDN in UBL JSON format (mandatory for eligible businesses)
- Supports all four document types: standard invoice (01), credit note (02), debit note (03), and self-billed invoice (11)
- Consolidated monthly submission for B2C transactions under RM 200
- LHDN QR code embedded on invoice PDF once submission is validated
- Real-time status polling; cancellation supported within LHDN's 72-hour window

### Expense Tracking with OCR
- Upload a receipt photo — GPT-4o Vision extracts vendor, amount, date, and suggests a category automatically
- If confidence is below 70%, a blank manual form is shown instead of a mis-filled one
- 52 pre-seeded expense categories mapped to Borang B sections D1–D20
- Entertainment expenses (D15) are stored at full amount; the 50% deductibility rule is applied automatically at tax calculation time

### Borang B Tax Preparation
- Aggregates all paid invoices (Part B income) and deductible expenses by Borang B section (Part D)
- Mileage logs contribute to D5 at the LHDN-approved tiered rate (RM 0.60/km for the first 200 km/month, RM 0.40/km thereafter)
- Personal relief inputs (EPF, medical, education, dependants, etc.) applied to arrive at chargeable income
- Progressive tax brackets for AY2024/2025 with a full bracket breakdown
- Exports a formatted Borang B summary PDF ready to hand to your tax agent

### Double-Entry Accounting (v2.0)
- Pre-seeded Chart of Accounts (35 accounts) mapped to Malaysian Borang B sections D1-D20
- General Ledger with automatic journal entry creation for every financial transaction
- GL Review Modal appears before each transaction — pre-fills smart defaults, allows manual account selection, or AI-powered suggestions via Claude
- Profit & Loss report with Revenue, COGS, Gross Profit, Operating Expenses (by Borang B section), and Net Profit — with PDF export
- Balance Sheet report with Assets, Liabilities, Owner's Equity, and automatic balance verification — with PDF export
- Trial Balance report
- Year-end closing automation: closes revenue/expense accounts to Retained Earnings, transfers Owner's Drawings to Capital
- Manual journal entries for adjustments not covered by standard transactions

### Dashboard & Reporting
- Financial overview: revenue, expenses, net profit, and outstanding balance — filterable by month, quarter, or year
- Upcoming deadlines: overdue invoices, due-soon invoices, and annual Borang B filing reminder (30 April)
- Cash flow projection: N-month forward view combining outstanding invoices, recurring entries, and historical averages
- Excel/CSV export for invoices and expenses; full JSON backup and restore

### Supporting Tools
- **Bank reconciliation** — import CSV bank statements and match rows to invoices or expenses
- **Mileage log** — track business trips with LHDN tiered deduction calculation (RM 0.60/km first 200 km, RM 0.40/km thereafter)
- **Document storage** — attach files to any record; store locally, on AWS S3, or Google Drive
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
│   │   ├── migrations/       # Sequelize migrations (24 tables)
│   │   ├── models/           # Sequelize models (25 including Account, JournalEntry, JournalEntryLine)
│   │   ├── routes/           # Route definitions (21 route files)
│   │   ├── schemas/          # Zod validation schemas
│   │   ├── seeders/          # Expense category seed data
│   │   ├── services/         # Business logic (MyInvois, OCR, PDF, tax, GL, reports, AI accounting)
│   │   └── templates/        # HTML templates for Gotenberg PDF (invoice, P&L, balance sheet)
│   │
│   └── web/                  # React frontend (port 5173)
│       └── src/
│           ├── components/   # AppShell, GLReviewModal, AddExpenseModal, PaymentModal, ConfirmModal, AttachmentsPanel, OCRAssistantModal, CustomerQuickCreateModal
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
│   └── development-plan.md   # Full module breakdown and architecture
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
| `/documents` | File attachments across all records |
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

## Documentation

| Document | Description |
|---|---|
| [Local Setup Guide](docs/local-setup.md) | Complete step-by-step setup for a fresh clone |
| [Development Plan](docs/development-plan.md) | Module breakdown, architecture decisions, API conventions, spec corrections |
| [CLAUDE.md](CLAUDE.md) | Codebase guidance for AI coding assistants |

## Releases

| Version | Date | Summary |
|---|---|---|
| [v2.1](docs/releases/v2.1.md) | 2026-03-27 | Duplicate records for invoices/expenses/mileage, fix mileage deduction rate to match LHDN tiered schedule |
| [v2.0](docs/releases/v2.0.md) | 2026-03-27 | Chart of Accounts, General Ledger, P&L, Balance Sheet, AI-powered GL suggestions |
| [v1.3](docs/releases/v1.3.md) | 2026-03-18 | Code quality, shared tax constants & minor fixes |
| [v1.2](docs/releases/v1.2.md) | 2026-02-27 | Modal forms, detail pages, polymorphic attachments & 14 bug fixes |
| v1.1 | 2026-02-20 | Docker build, env loading, bank reconciliation refactor, UI fixes |
| v1.0 | 2026-02-10 | Initial release |

---

## Malaysian compliance notes

- **LHDN MyInvois**: Sandbox environment available for testing at `https://preprod-api.myinvois.hasil.gov.my`. Production credentials are configured through the app UI (Settings → E-Invoice), not the `.env` file.
- **Borang B**: Tax calculations use AY2024/2025 progressive brackets (0%–30%). Tax bracket data lives in `packages/shared/src/constants/taxBrackets.js` and must be updated when LHDN announces changes.
- **Mileage**: LHDN-approved tiered rate — RM 0.60/km for the first 200 km/month, RM 0.40/km thereafter.
- **GST/SST**: The system supports per-line tax rates on invoices. No hard-coded tax rate — the business owner sets the applicable rate per line item.
- **Currency**: All financial records store the original currency and exchange rate alongside an `amount_myr` field for reporting. Reporting and Borang B calculations use the MYR value.

---

## Roadmap

- [ ] Recurring expense management UI (backend already scaffolded)
- [ ] Audit trail viewer page (`audit_logs` table is populated, no UI yet)
- [ ] Live MYR exchange rates via a public API (currently manual input)
- [ ] Invoice delivery by email with PDF attachment
- [ ] Read-only customer portal for invoice viewing
- [ ] Multi-currency General Ledger support
