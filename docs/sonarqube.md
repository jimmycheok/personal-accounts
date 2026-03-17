# SonarQube Code Quality Review

**Project:** jimmycheok_personal-accounts
**Reviewed:** 2026-03-17
**Quality Gate:** NONE (no quality gate configured — see Recommendations)

## Metrics Snapshot

| Metric | Value |
|---|---|
| Bugs | 7 |
| Vulnerabilities | 10 |
| Code Smells | 422 |
| Coverage | N/A (no tests) |
| Duplication | 2.1% |
| Reliability Rating | E (5.0) |
| Security Rating | E (5.0) |
| Maintainability Rating | A (1.0) |

## Quality Gate Conditions

No quality gate has been configured for this project in SonarQube. A gate should be set up to enforce minimum thresholds before merging (see Recommendations).

## Issues Summary

| Severity | Count |
|---|---|
| BLOCKER | 11 |
| CRITICAL | 25 |
| MAJOR | 121 |
| MINOR | 282 |
| **Total** | **439** |

## Issues Fixed

| Severity | File | Line | Rule | Description | Fix Applied |
|---|---|---|---|---|---|
| BLOCKER | `apps/api/routes/cashFlow.js` | 46 | javascript:S2189 | `cursor` declared `const` — SonarQube flags loop as potentially infinite since reference appears immutable | Changed `const cursor` → `let cursor` |
| BLOCKER | `apps/api/config/agenda.js` | 10 | secrets:S6694 | MongoDB password hardcoded in fallback connection string | Removed credentials from fallback URI (`mongodb://localhost:27017/agenda`) |
| BLOCKER | `apps/api/config/database.js` | 5, 24 | secrets:S6698 | PostgreSQL password hardcoded in two fallback URLs | Removed password from fallback URLs (kept user, dropped `:pa_password`) |
| BLOCKER | `apps/api/config/database.cjs` | 10 | secrets:S6698 | PostgreSQL password hardcoded in fallback URL | Removed password from fallback URL |
| BLOCKER | `docker-compose.yml` | 9, 24, 59, 64, 66 | secrets:S6698 / S6694 | DB passwords hardcoded inline in docker-compose service definitions | Switched to `${DB_PASSWORD:-pa_password}` and `${MONGO_PASSWORD:-pa_mongo_pass}` env var interpolation |
| BLOCKER | `apps/api/services/StorageService.js` | 30–31 | jssecurity:S2083 | Path traversal — `storagePath` from upload request used directly in `path.join` without sanitisation | Added `path.resolve` + prefix check in `upload`, `download`, and `delete` methods |
| CRITICAL | `apps/api/routes/cashFlow.js` | 66 | javascript:S2871 | `Array.sort()` without compare function — unreliable for string sorting | Changed to `.sort((a, b) => a.localeCompare(b))` |

## Security Hotspots

| Status | File | Line | Category | Description |
|---|---|---|---|---|
| TO_REVIEW | `apps/api/Dockerfile` | 6 | permission | `COPY . .` glob may inadvertently add sensitive files to the image |
| TO_REVIEW | `apps/web/Dockerfile` | 6 | permission | `COPY . .` glob may inadvertently add sensitive files to the image |
| TO_REVIEW | `apps/api/Dockerfile` | 1 | permission | `node` base image runs as `root` by default |
| TO_REVIEW | `apps/web/Dockerfile` | 24 | permission | `nginx` base image runs as `root` by default |

## Issues Requiring Manual Review

| Severity | File | Line | Rule | Reason not auto-fixed |
|---|---|---|---|---|
| BLOCKER | `apps/api/services/MyInvoisService.js` | 259 | javascript:S3516 | `pollStatus` always returns `submission` — all 3 code paths return the same variable; restructuring would change the caller API contract |
| CRITICAL | `apps/api/services/MyInvoisService.js` | 22 | javascript:S5542 | AES-256-CBC used for LHDN client secret encryption; SonarQube recommends AES-GCM (authenticated). Migration requires re-encrypting all existing `client_secret_enc` rows and updating the storage format — must be done as a planned migration |
| CRITICAL | `apps/api/routes/export.js` | 164 | javascript:S3776 | Function cognitive complexity 40/15 — requires architectural refactoring of the export route |
| CRITICAL | Multiple frontend pages | various | javascript:S2004 | Functions nested > 4 levels deep in DataTable row action handlers across Invoices, Expenses, Customers, Quotations, Mileage, BankReconciliation, Documents, CreditNotes pages — requires extracting handlers into named functions outside JSX |

## Duplicated Files

| File | Duplicated Lines | Duplication % |
|---|---|---|
| `apps/web/src/pages/Quotations/QuotationForm.jsx` | 111 | 38.0% |
| `apps/web/src/pages/Invoices/InvoiceForm.jsx` | 111 | 32.2% |
| `apps/web/src/pages/Settings/index.jsx` | 78 | 18.7% |
| `apps/web/src/pages/Invoices/InvoiceDetail.jsx` | 56 | 18.4% |
| `apps/web/src/pages/Quotations/QuotationDetail.jsx` | 43 | 18.1% |
| `apps/api/routes/quotations.js` | 24 | 15.9% |
| `apps/web/src/pages/Quotations/index.jsx` | 14 | 8.7% |
| `apps/web/src/pages/CreditNotes/index.jsx` | 14 | 6.9% |
| `apps/web/src/pages/CreditNotes/CreditNoteDetail.jsx` | 13 | 5.5% |

## Recommendations

- **Configure a SonarQube Quality Gate** — no gate is currently active; add thresholds for Bugs = 0, Vulnerabilities = 0, Coverage ≥ 60%, Duplication < 5% to block failing PRs.
- **Migrate AES encryption to GCM mode** — `MyInvoisService` uses AES-256-CBC which lacks authentication. Plan a migration: add a `decrypt_v2` helper using AES-256-GCM, re-encrypt the `client_secret_enc` column, then swap out the old functions.
- **Fix Dockerfile security hotspots** — add a `.dockerignore` file to exclude `.env`, `node_modules`, `*.pem`, and other sensitive files from `COPY . .`; add `USER node` (API) and `USER nginx` (web) before the `CMD` line to drop root privileges.
- **Extract DataTable row-action handlers** — across 8 frontend list pages, named handler functions extracted outside JSX will fix the S2004 nesting violations and improve readability.
- **Consolidate InvoiceForm / QuotationForm duplication** — 111 lines are duplicated between the two forms (38–32%). Extract shared line-item logic into a reusable `LineItemsTable` component to reduce duplication below the 5% threshold.
- **Add unit/integration tests** — coverage is 0%. Start with `TaxCalculator`, `DuitNowService`, and `StorageService` as they are pure-ish services without HTTP side-effects.
- **Set `DB_PASSWORD` and `MONGO_PASSWORD` in `.env`** — the docker-compose defaults now fall back to `pa_password` / `pa_mongo_pass`; override these in `.env` for any environment beyond quick local dev.
