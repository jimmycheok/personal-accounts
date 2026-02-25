# Personal Accountant

An all-in-one accounting system built for a single Malaysian sole proprietor. Handles the complete financial lifecycle — from quoting and invoicing through to LHDN MyInvois e-invoice submission and annual Borang B tax preparation.

---

## What it does

### Invoicing & Sales
- Create quotations and convert accepted ones directly into invoices
- Generate professional PDF invoices with embedded DuitNow QR codes for instant payment
- Record partial or full payments; invoices auto-mark as paid when settled
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
- Mileage logs contribute to D5 at the LHDN-approved RM 0.25/km rate
- Personal relief inputs (EPF, medical, education, dependants, etc.) applied to arrive at chargeable income
- Progressive tax brackets for AY2024/2025 with a full bracket breakdown
- Exports a formatted Borang B summary PDF ready to hand to your tax agent

### Dashboard & Reporting
- Financial overview: revenue, expenses, net profit, and outstanding balance — filterable by month, quarter, or year
- Upcoming deadlines: overdue invoices, due-soon invoices, and annual Borang B filing reminder (30 April)
- Cash flow projection: N-month forward view combining outstanding invoices, recurring entries, and historical averages
- Excel/CSV export for invoices and expenses; full JSON backup and restore

### Supporting Tools
- **Bank reconciliation** — import CSV bank statements and match rows to invoices or expenses
- **Mileage log** — track business trips with automatic deduction calculation
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
| PDF generation | Gotenberg v8 (Docker) + chromiumly |
| OCR | OpenAI GPT-4o Vision |
| Authentication | JWT (single owner) |
| Encryption | AES-256-CBC (for LHDN credentials at rest) |

---

## Repository layout

```
personal-accountant/
├── apps/
│   ├── api/                  # Express.js backend (port 3001)
│   │   ├── app.js            # Entry point
│   │   ├── config/           # Database, Agenda, storage config
│   │   ├── controllers/      # Request handlers
│   │   ├── jobs/             # Agenda scheduled jobs
│   │   ├── middlewares/      # JWT auth, error handler, audit log
│   │   ├── migrations/       # Sequelize migrations (21 tables)
│   │   ├── models/           # Sequelize models
│   │   ├── routes/           # Route definitions (18 route files)
│   │   ├── schemas/          # Zod validation schemas
│   │   ├── seeders/          # Expense category seed data
│   │   ├── services/         # Business logic (MyInvois, OCR, PDF, tax, etc.)
│   │   └── templates/        # HTML templates for Gotenberg PDF
│   │
│   └── web/                  # React frontend (port 5173)
│       └── src/
│           ├── components/   # AppShell (header + sidenav)
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
| `/quotations` | Quotation management with convert-to-invoice action |
| `/credit-notes` | Credit note issuance and LHDN submission |
| `/expenses` | Split-panel OCR receipt upload + expense table |
| `/taxation` | Borang B summary, relief inputs, tax estimate, PDF export |
| `/cash-flow` | Projected vs actual cash flow line chart |
| `/bank-reconciliation` | CSV import and transaction matching |
| `/mileage` | Trip log with annual deduction summary |
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
node --watch app.js
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
| [Development Plan](docs/development-plan.md) | Module breakdown, architecture decisions, API conventions |
| [CLAUDE.md](CLAUDE.md) | Codebase guidance for AI coding assistants |

---

## Malaysian compliance notes

- **LHDN MyInvois**: Sandbox environment available for testing at `https://preprod-api.myinvois.hasil.gov.my`. Production credentials are configured through the app UI (Settings → E-Invoice), not the `.env` file.
- **Borang B**: Tax calculations use AY2024/2025 progressive brackets (0%–30%). Tax bracket data lives in `packages/shared/src/constants/taxBrackets.js` and must be updated when LHDN announces changes.
- **Mileage**: RM 0.25/km is the current LHDN-approved deductible rate for business travel.
- **GST/SST**: The system supports per-line tax rates on invoices. No hard-coded tax rate — the business owner sets the applicable rate per line item.
- **Currency**: All financial records store the original currency and exchange rate alongside an `amount_myr` field for reporting. Reporting and Borang B calculations use the MYR value.

---

## v1.1 roadmap

- [ ] Recurring expense management UI (backend already scaffolded)
- [ ] Audit trail viewer page (`audit_logs` table is populated, no UI yet)
- [ ] Live MYR exchange rates via a public API (currently manual input)
- [ ] Invoice delivery by email with PDF attachment
- [ ] Read-only customer portal for invoice viewing
