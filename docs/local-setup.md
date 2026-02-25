# Local Environment Setup Guide

Complete step-by-step guide to get the Personal Accountant running on a fresh clone.

---

## Prerequisites

Install these tools before starting:

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| Yarn | 1.x | `npm install -g yarn` |
| Docker Desktop | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| Git | Any | Usually pre-installed |

Verify your setup:

```bash
node --version      # v18.x or v20.x
yarn --version      # 1.22.x
docker --version    # 24.x or later
docker compose version
```

---

## Step 1 — Clone and install dependencies

```bash
git clone <repo-url> personal-accountant
cd personal-accountant

# Install all workspace dependencies (api + web + shared)
yarn install
```

---

## Step 2 — Create your .env file

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

### Required (app will not start without these)

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-char random string>

# Must be exactly 32 characters
AES_SECRET_KEY=<32-char string, e.g. "MySecretKey12345MySecretKey12345">

# Your initial login password (you can change it after first login)
ADMIN_PASSWORD=changeme123
```

### Required for OCR expense scanning

```env
OPENAI_API_KEY=sk-...
```

Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). The app uses GPT-4o for receipt scanning. Without this key, the OCR upload feature will throw an error — all other features work fine.

### Leave as-is for local development

The database, MongoDB, and Gotenberg values in `.env.example` already match what Docker Compose spins up:

```env
DATABASE_URL=postgres://pa_user:pa_password@localhost:5432/personal_accountant
MONGODB_URI=mongodb://admin:pa_mongo_pass@localhost:27017/agenda?authSource=admin
GOTENBERG_URL=http://localhost:3002
```

### Optional — only if you configure them

- **Email reminders**: Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- **AWS S3 storage**: Fill in `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`
- **Google Drive storage**: Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **LHDN MyInvois**: Configured through the app UI (Settings → E-Invoice), not via `.env`

---

## Step 3 — Start infrastructure services

```bash
docker compose up -d postgres mongodb gotenberg
```

This starts:
- **PostgreSQL 15** on `localhost:5432`
- **MongoDB 7** on `localhost:27017`
- **Gotenberg 8** (PDF engine) on `localhost:3002`

Wait for all three to be healthy before continuing:

```bash
docker compose ps
# All three should show "healthy" status (takes ~15 seconds)
```

---

## Step 4 — Run database migrations and seed data

```bash
cd apps/api
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

This creates all 21 database tables and seeds 52 expense categories mapped to Borang B sections D1–D20.

Verify:

```bash
# Should print a list of applied migrations
npx sequelize-cli db:migrate:status
```

---

## Step 5 — Start the API

```bash
# Still in apps/api/
node --watch app.js
```

You should see:

```
✓ PostgreSQL connected
✓ Agenda (MongoDB) started
✓ API server running on http://localhost:3001
```

Test it:

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

---

## Step 6 — Start the web app

Open a **new terminal tab**:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Step 7 — First login and onboarding

1. Enter the password you set as `ADMIN_PASSWORD` in `.env` (default: `changeme123`)
2. Complete the **4-step onboarding wizard**:
   - **Step 1 — Business Info**: Enter your business name, SSM number, address, bank details (required to proceed)
   - **Step 2 — E-Invoice Setup**: Enter LHDN MyInvois credentials (can skip, configure later in Settings)
   - **Step 3 — Storage**: Choose local storage (default) or configure S3/Google Drive (can skip)
   - **Step 4 — Review**: Click "Launch" to complete setup
3. You'll land on the Dashboard

> To change your password after logging in: Settings → Preferences → Change Password

---

## Service ports at a glance

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3001 |
| API health check | http://localhost:3001/health |
| Gotenberg (PDF) | http://localhost:3002 |
| PostgreSQL | localhost:5432 |
| MongoDB | localhost:27017 |

---

## Resetting the database

If you need a clean slate:

```bash
cd apps/api
npx sequelize-cli db:seed:undo:all   # remove seed data
npx sequelize-cli db:migrate:undo:all # drop all tables
npx sequelize-cli db:migrate          # recreate tables
npx sequelize-cli db:seed:all         # re-seed categories
```

Or to wipe the Docker volumes entirely:

```bash
docker compose down -v   # removes all data volumes
docker compose up -d postgres mongodb gotenberg
```

Then re-run migrations and seeds.

---

## Stopping everything

```bash
# Stop the Node processes with Ctrl+C in each terminal

# Stop Docker services
docker compose down

# Stop and remove all data (destructive)
docker compose down -v
```

---

## Troubleshooting

**`yarn install` fails with workspace errors**
Make sure you're running `yarn install` from the repo root, not inside `apps/api` or `apps/web`.

**`sequelize-cli db:migrate` fails with "ECONNREFUSED"**
PostgreSQL isn't running yet. Check `docker compose ps` — the postgres service must show `healthy`.

**`sequelize-cli` command not found**
Run it via npx: `npx sequelize-cli db:migrate`

**API starts but crashes immediately**
Check that `.env` exists in the repo root (not inside `apps/api/`). The API reads it from `process.cwd()` via `dotenv/config`.

**Agenda fails to connect**
MongoDB isn't running. Check `docker compose ps` — the mongodb service must show `healthy`.

**PDF generation returns an error**
Gotenberg isn't running. Check `docker compose ps` and verify `GOTENBERG_URL=http://localhost:3002` in your `.env`.

**Login fails with "Invalid password"**
Your `ADMIN_PASSWORD` in `.env` must match what you type. If you previously set a password through the UI and forgot it, reset it by running:
```bash
# Connect to postgres
docker exec -it $(docker compose ps -q postgres) psql -U pa_user -d personal_accountant

# Clear the stored password hash (reverts to ADMIN_PASSWORD env var)
UPDATE business_profiles SET preferences = preferences - 'password_hash';
\q
```
