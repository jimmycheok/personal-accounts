# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal Accountant — an all-in-one accounting system for a Malaysian sole proprietor. Features invoicing, expense tracking, LHDN MyInvois e-invoice compliance, and Borang B tax preparation.

## Commands

### Local development (without Docker)
```bash
# Start infrastructure (required before running the API)
docker-compose up -d postgres mongodb gotenberg

# Install all workspace dependencies from repo root
yarn install

# Run database migrations and seed expense categories
cd apps/api
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all

# Start API (port 3001) — from apps/api/
node --watch server.js

# Start web dev server (port 5173) — from apps/web/
npm run dev
```

### Full Docker stack
```bash
docker-compose up --build
```

### Database operations (run from apps/api/)
```bash
npx sequelize-cli db:migrate              # run pending migrations
npx sequelize-cli db:migrate:undo         # rollback last migration
npx sequelize-cli db:seed:all             # seed expense categories (D1-D20)
npx sequelize-cli db:seed:undo:all        # unseed
```

### Web build
```bash
cd apps/web && npm run build              # outputs to apps/web/dist/
```

## Architecture

### Monorepo layout
- `apps/api/` — Express.js v5 backend (ES modules, `"type": "module"`)
- `apps/web/` — React 18 + Vite + IBM Carbon Design System frontend
- `packages/shared/` — Malaysian tax constants shared between API and web

### Critical ESM / CJS split
The API uses ES modules throughout **except** for Sequelize CLI tooling:
- Migrations and seeders use `.cjs` extension (CommonJS)
- `.sequelizerc` points to `config/database.cjs` (the CJS config twin of `config/database.js`)
- When adding a new migration or seeder, use `.cjs` extension

### Request lifecycle
1. All API routes live under `/api/v1/`
2. Every route (except `POST /auth/login` and `GET /health`) requires `verifyJwt` middleware
3. Controllers call Sequelize models directly; complex logic is delegated to services
4. Financial mutations write to `audit_logs` via `writeAuditLog()` in `middlewares/auditLog.js`

### Authentication
Single-owner JWT auth. The password hash is stored in `business_profiles.preferences.password_hash` (JSONB field). On first run before onboarding, the `ADMIN_PASSWORD` env var is used as the password. There is no user table.

### Database models (PostgreSQL via Sequelize)
All models use `underscored: true` (camelCase JS ↔ snake_case DB). Key relationships:
- `Invoice` → `Customer`, `InvoiceItem[]`, `Payment[]`, `EinvoiceSubmission[]`
- `Quotation` → `Customer`, `QuotationItem[]` → can convert to `Invoice`
- `Expense` → `ExpenseCategory` (which carries `borang_b_section`)
- `Document` is polymorphic via `subject_type` + `subject_id`
- `EinvoiceSubmission` links to either `invoice_id` or `credit_note_id`

### Agenda jobs (MongoDB-backed)
Defined in `apps/api/jobs/`. Each job is a separate file that exports a `define*Job(agenda)` function. `jobs/index.js` registers all jobs and sets their schedules. MongoDB stores job state so jobs survive server restarts.

| Job | Schedule |
|---|---|
| `check-overdue-invoices` | Daily 00:00 |
| `generate-recurring-entries` | Daily 06:00 |
| `send-payment-reminders` | Daily 09:00 |
| `poll-einvoice-status` | Every 30 min |
| `cleanup-temp-files` | Daily 02:00 |

### Services
- **`MyInvoisService`** — singleton. Manages LHDN OAuth2 token (cached in `einvoice_configs` table with 60-min TTL). Builds UBL JSON documents, submits to LHDN, polls status. Client secret is AES-256-CBC encrypted (`iv_hex:ciphertext_hex` format) using `AES_SECRET_KEY` env var.
- **`TaxCalculator`** — aggregates paid invoices (income) + expenses by `borang_b_section` + mileage logs. Entertainment expenses (D15) automatically get 50% deductibility applied.
- **`StorageService`** — strategy pattern. Reads `storage_configs` table to determine backend (local/aws_s3/google_drive). Local files stored under `uploads/{type}/{year}/{month}/{uuid}.ext`.
- **`PdfService`** — reads HTML templates from `apps/api/templates/`, does `{{placeholder}}` substitution, sends rendered HTML to Gotenberg via native `fetch` POST to `/forms/chromium/convert/html`. Supports invoice, quotation, credit note, and tax summary PDFs.
- **`DuitNowService`** — generates EMVCo-compliant QR payloads with CRC-16 checksum.
- **`OcrService`** — sends base64 image to GPT-4o with `response_format: json_object`. Returns `{ vendor, amount, date, category_suggestion, confidence }`. If `confidence < 70`, the frontend shows a blank manual form.

### Shared constants (`packages/shared/src/constants/`)
- `taxBrackets.js` exports `calculateTax(chargeableIncome, year)` — used by both API `TaxCalculator` and web `Taxation` page
- `borangBMapping.js` exports `DEFAULT_EXPENSE_CATEGORIES` (seeded to DB) and `BORANG_B_SECTIONS` (D1–D20 with labels and deductibility rules)
- Import in API: `import { calculateTax } from '@personal-accountant/shared/constants/taxBrackets'` (no `.js` extension — resolved via the package's `exports` field)

### Customer management
- Full CRUD at `apps/web/src/pages/Customers/index.jsx` — routed to `/customers`, accessible from sidebar (UserMultiple icon between Dashboard and Invoices).
- Fields: name, customer_type (B2B/B2C/B2G), TIN, id_type/id_value, email, phone, full address, notes, is_active.
- **Inline quick-create**: `apps/web/src/components/CustomerQuickCreateModal.jsx` — lightweight modal used in `InvoiceForm` and `QuotationForm`. A "New Customer" button sits beneath the customer ComboBox; on submit the new customer is auto-selected.

### Frontend routing
`apps/web/src/App.jsx` — `PrivateRoute` checks `AuthContext`. If `onboardingCompleted` is false (from `AppSettingsContext`), the app should redirect to `/onboarding`. The onboarding wizard is full-screen (no `AppShell`); all other pages render inside `AppShell` (Carbon `Header` + `SideNav`).

### API calls from frontend
All go through `apps/web/src/services/api.js` — an Axios instance with base URL `VITE_API_URL/api/v1`, JWT `Authorization` header injected automatically, and a response interceptor that redirects to `/login` on 401.

### PDF generation
Gotenberg runs at `GOTENBERG_URL` (port 3002 locally). `PdfService` posts HTML directly to Gotenberg's `/forms/chromium/convert/html` endpoint via native `fetch` (no `chromiumly` dependency). Templates are in `apps/api/templates/invoice.html` and `tax-summary.html`. The `{{invoice.items}}` array is not auto-rendered — if you extend templates, you'll need a real template engine or inject pre-rendered HTML fragments.

### E-invoice flow
1. `POST /api/v1/invoices/:id/submit-einvoice` → `MyInvoisService.submitDocument(id)`
2. Builds UBL JSON, base64-encodes, posts to LHDN `/api/v1.0/documentsubmissions`
3. Creates `EinvoiceSubmission` row with `status: 'pending'`
4. `poll-einvoice-status` Agenda job or `GET /invoices/:id/einvoice-status` polls LHDN for the result
5. On `valid` status: `long_id` stored on `Invoice.einvoice_long_id` (used for LHDN QR on PDF)
6. Cancellation only allowed within 72h of `valid` status per LHDN rules

### Payments route is double-mounted
`app.js` mounts `paymentsRoutes` at `/api/v1/invoices` (same prefix as `invoicesRoutes`). The payments router uses `mergeParams: true` and handles `/invoices/:invoiceId/payments`. Posting a payment auto-recalculates `amount_paid`, `amount_due`, and sets invoice to `paid` when fully settled.

## Environment variables
Copy `.env.example` to `.env`. Critical vars:
- `JWT_SECRET` — must be set to a long random string in production
- `AES_SECRET_KEY` — exactly 32 chars; used to encrypt LHDN client_secret
- `ADMIN_PASSWORD` — initial login password before onboarding sets a hash
- `OPENAI_API_KEY` — required for OCR expense scanning
- `MONGODB_URI` — Agenda job persistence
- `GOTENBERG_URL` — PDF generation sidecar

## Malaysian tax specifics
- **Borang B sections** D1–D20 map to expense categories. D15 (Entertainment) is 50% deductible — enforced in `TaxCalculator.getExpensesBySection()`, not at data entry.
- **Mileage rate**: RM 0.25/km, added to D5 (Motor Vehicle) in the tax calculation.
- **LHDN MyInvois**: Sandbox URL is `https://preprod-api.myinvois.hasil.gov.my`; toggle via `einvoice_configs.is_sandbox`. B2C transactions < RM200 use consolidated monthly submission (document type `01`, special buyer TIN `EI00000000010`).
- **Assessment years**: Tax bracket data in `packages/shared/src/constants/taxBrackets.js` currently covers AY2024 and AY2025 (same brackets until LHDN updates).
