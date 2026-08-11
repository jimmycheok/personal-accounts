#!/usr/bin/env bash
#
# Production deploy for Personal Accountant.
#
# Lives on the `production` branch alongside docker-compose.prod.yml, because it
# must stay in step with the seeders and migrations a release ships. Run it from
# the directory that contains the checkout.
#
#   ./scripts/deploy.sh
#
# Order matters and is deliberate:
#   backup -> build -> migrate -> SEED -> serve
# Seeding happens before `up -d` so the API never serves traffic against a
# database missing an account its code requires.

set -euo pipefail

REPO_DIR="${REPO_DIR:-personal-accounts}"
BACKUP_DIR="${BACKUP_DIR:-$HOME}"

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisite seeders.
#
# These create Chart of Accounts rows that application code looks up by code. If
# they have not been applied, `getAccountByCode` throws:
#   6995 -> every non-deductible expense (v2.4)
#   6410 -> every mileage log            (v2.5)
#
# Releases often ship a seeder and NO migration, so the migrate step above is a
# no-op for them. Add a line here whenever a release adds a guarded account
# seeder. All of these are individually guarded, so re-running is safe.
#
# NEVER use `db:seed:all`. `seederStorage` is not configured, so sequelize-cli
# does not track which seeders have run and `db:seed:all` re-runs every one of
# them — including 20260327000002-retroactive-journal-entries.cjs, which does raw
# INSERT INTO journal_entries with no existence guard. A second run duplicates
# every journal entry, which since v2.4 doubles every figure on cash flow, the
# dashboard and Borang B.
# ─────────────────────────────────────────────────────────────────────────────
SEEDERS=(
  20260806000001-non-deductible-account.cjs
  20260806000002-mileage-claim-account.cjs
)

cd "$REPO_DIR"
git checkout production
git fetch
git reset --hard origin/production   # production is rebased, so reset (not pull)

COMPOSE="docker compose -f docker-compose.prod.yml"

# 0. Back up. Nothing below this line has an undo.
echo "=== Backing up database ==="
$COMPOSE up -d postgres
until $COMPOSE exec -T postgres pg_isready -U pa_user -d personal_accountant >/dev/null 2>&1; do
  sleep 2
done
BACKUP="$BACKUP_DIR/pa-backup-$(date +%Y%m%d-%H%M%S).dump"
$COMPOSE exec -T postgres pg_dump -U pa_user -d personal_accountant --format=custom > "$BACKUP"
if [ ! -s "$BACKUP" ]; then
  echo "FATAL: backup at $BACKUP is empty — aborting before anything is changed." >&2
  exit 1
fi
echo "Backup written: $BACKUP ($(du -h "$BACKUP" | cut -f1))"

# 1. Build new images (picks up dependency changes).
echo "=== Building images ==="
$COMPOSE build

# 2. Show migration state before changing anything.
echo "=== Migration status ==="
$COMPOSE run --rm api npx sequelize-cli db:migrate:status

# 3. Run migrations before serving traffic. Only pending ones run.
echo "=== Running migrations ==="
$COMPOSE run --rm api npm run migrate

# 4. Seed prerequisite accounts — BEFORE the API serves traffic.
echo "=== Seeding prerequisite accounts ==="
for seeder in "${SEEDERS[@]}"; do
  echo "--- $seeder"
  $COMPOSE run --rm api npx sequelize-cli db:seed --seed "$seeder"
done

# 5. Verify the accounts actually exist. Cheaper to fail here than to discover
#    it when a user saves an expense.
echo "=== Verifying prerequisite accounts ==="
MISSING=$($COMPOSE exec -T postgres psql -U pa_user -d personal_accountant -tAc \
  "SELECT string_agg(c, ', ') FROM (VALUES ('6995'),('6410')) v(c)
   WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.code = v.c);")
if [ -n "${MISSING// /}" ]; then
  echo "FATAL: prerequisite accounts missing: $MISSING" >&2
  echo "The API would throw on every affected transaction. Not starting services." >&2
  exit 1
fi
echo "Prerequisite accounts present."

# 6. Start / recreate all services.
echo "=== Starting services ==="
$COMPOSE up -d

cat <<'NEXT'

=== Deploy complete ===

Post-deploy checks, in order:

  1. Ledger gaps (v2.4 backfill). Dry run first — it writes to live books:
       docker compose -f docker-compose.prod.yml run --rm api \
         node scripts/backfill-journal-entries.js

     Only run with --apply if BOTH the AMBIGUOUS count and the orphan
     (source_id IS NULL) count are zero. One operator, one run — the script
     has no inter-process lock.

  2. Confirm the three money surfaces agree for the same period:
       /api/v1/dashboard/overview?period=year   -> totalIncome / totalExpenses
       /api/v1/cash-flow/actual                 -> totals
       /api/v1/taxation/borang-b?year=<year>    -> partD.totalExpenses

     Dashboard and cash flow must report identical figures. They are the same
     query, so a mismatch means something is wrong.

  3. If Borang B shows a mileage overlap warning, review D5 before filing —
     a per-km claim substitutes for actual vehicle costs, it does not add to
     them.

NEXT
