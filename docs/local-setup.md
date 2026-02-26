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

> **PostgreSQL note:** Docker Desktop is only required for MongoDB and Gotenberg. If you already have PostgreSQL running locally on port 5432, you can skip the Docker PostgreSQL container and point the app at your local instance instead — see [Step 3](#step-3--start-infrastructure-services) for details.

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

### Database connection

**Option A — Docker PostgreSQL**

The Docker postgres service maps host port **5433** → container port 5432 (to avoid clashing with any local Postgres already running on 5432). Use these values in `.env`:

```env
DATABASE_URL=postgres://pa_user:pa_password@localhost:5433/personal_accountant
DB_HOST=localhost
DB_PORT=5433
DB_NAME=personal_accountant
DB_USER=pa_user
DB_PASSWORD=pa_password
```

> Port 5433 is only for connections **from your host machine** (e.g. sequelize-cli, pgAdmin). Inside Docker, the api container connects to the postgres container directly via the internal Docker network on port 5432 — this is handled automatically by `docker-compose.yml` and requires no change to `.env`.

**Option B — Local PostgreSQL (already running on 5432)**

Create a database and user, then use port 5432 in `.env`:

```bash
# In psql or your Postgres client:
CREATE DATABASE personal_accountant;
CREATE USER pa_user WITH PASSWORD 'pa_password';
GRANT ALL PRIVILEGES ON DATABASE personal_accountant TO pa_user;
```

```env
DATABASE_URL=postgres://pa_user:pa_password@localhost:5432/personal_accountant
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personal_accountant
DB_USER=pa_user
DB_PASSWORD=pa_password
```

You can use your existing superuser (e.g. `postgres`) instead of creating a new one — just update `DB_USER` and `DB_PASSWORD` to match.

**MongoDB and Gotenberg** always run via Docker regardless of which PostgreSQL option you choose:

```env
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

Choose the option that matches your setup:

### Option A — Docker PostgreSQL

```bash
docker compose up -d postgres mongodb gotenberg
```

This starts:
- **PostgreSQL 15** on `localhost:**5433**` (host) → container port 5432
- **MongoDB 7** on `localhost:27017`
- **Gotenberg 8** (PDF engine) on `localhost:3002`

Wait for all three to be healthy before continuing:

```bash
docker compose ps
# All three should show "healthy" status (takes ~15 seconds)
```

Make sure your `.env` uses `DB_PORT=5433` (see Step 2 — Option A).

### Option B — Local PostgreSQL (port 5432 already in use)

If you already have PostgreSQL running on your machine, skip the Docker postgres container entirely. Start only MongoDB and Gotenberg:

```bash
docker compose up -d mongodb gotenberg
```

Then create the database in your local Postgres if you haven't already (see Step 2 — Option B above). Your `.env` should use `DB_PORT=5432`.

Verify MongoDB and Gotenberg are healthy:

```bash
docker compose ps
# mongodb and gotenberg should show "healthy"
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

Choose how you want to run the API:

### Option A — Direct Node (local development)

```bash
# From apps/api/
node --watch app.js
```

`app.js` loads `.env` from the repo root automatically using its own file path — no need to set `cwd` manually.

### Option B — PM2 (process manager / server deployment)

A ready-made PM2 ecosystem file is included at the repo root:

```bash
# From repo root — install PM2 if you haven't already
npm install -g pm2

pm2 start ecosystem.config.cjs
pm2 save          # persist across reboots
pm2 startup       # generate startup script
```

PM2 reads `.env` via its `env_file` setting and injects all variables before the app starts. The `app.js` dotenv call then skips any variables already set (no override).

Useful PM2 commands:

```bash
pm2 logs pa-api       # tail logs
pm2 restart pa-api    # restart
pm2 stop pa-api       # stop
pm2 delete pa-api     # remove from PM2
```

Logs are written to `logs/api-out.log` and `logs/api-error.log`.

### Option C — Docker (full stack)

See [Running with Docker](#running-with-docker) below.

---

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

### Option A — Vite dev server (local development)

Open a **new terminal tab**:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Hot-reload is enabled — changes to source files reflect instantly without a page refresh.

### Option B — Docker (production build served by nginx)

The web Dockerfile builds the Vite app and serves it via nginx on port 80, mapped to host port 5173:

```bash
# Build and start the web container (from repo root)
docker compose up --build web
```

Or if the api container is already running:

```bash
docker compose build web
docker compose up web
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**How the web Docker container works:**
- Vite builds a static production bundle (`dist/`)
- nginx serves the static files and handles SPA routing (`try_files $uri /index.html`)
- nginx proxies `/api` requests to the api container at `http://api:3001` on the internal Docker network
- `VITE_API_URL` must be set to `http://localhost:3001` so the browser can reach the API from outside Docker

> **Note:** Unlike the dev server, the Docker web container does **not** hot-reload. Rebuild with `docker compose build web` after making frontend changes.

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
| PostgreSQL (Docker) | localhost:5433 |
| PostgreSQL (local) | localhost:5432 |
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

Or to wipe the Docker volumes entirely (Option A — Docker Postgres only):

```bash
docker compose down -v   # removes all data volumes
docker compose up -d postgres mongodb gotenberg
```

If you're using a local Postgres (Option B), drop and recreate the database manually:

```bash
# In psql:
DROP DATABASE personal_accountant;
CREATE DATABASE personal_accountant;
GRANT ALL PRIVILEGES ON DATABASE personal_accountant TO pa_user;
```

Then re-run migrations and seeds.

---

## Running with Docker

To run the full stack (API + infrastructure) in Docker:

```bash
docker compose up -d postgres mongodb gotenberg
docker compose up api
```

Or all services at once:

```bash
docker compose up --build
```

**How environment variables work in Docker:**
The `docker-compose.yml` `environment:` section sets all variables using `${VAR}` interpolation from your repo-root `.env` file. Database/MongoDB/Gotenberg hostnames are always set to the Docker service names (`postgres`, `mongodb`, `gotenberg`) — these override any `localhost` values in `.env`. The `app.js` dotenv call is a no-op inside Docker (vars are already in the environment).

> **Note:** `DB_HOST=localhost` in your `.env` is only used for local/PM2 runs. Docker always uses `DB_HOST=postgres` (the service name) regardless of your `.env`.

---

## Environment variable loading — how it works

The app uses a layered approach so the same codebase works across all deployment methods:

| Scenario | Who loads `.env` | dotenv in `app.js` |
|---|---|---|
| `node --watch app.js` | `app.js` (via `__dirname`-relative path) | Loads `.env` ✓ |
| PM2 via `ecosystem.config.cjs` | PM2 (`env_file: .env`) before app starts | Skips (already set) ✓ |
| Docker Compose | `environment:` section in compose file | Skips (already set) ✓ |
| `npx sequelize-cli db:migrate` | `database.cjs` (only if `DATABASE_URL` not set) | N/A ✓ |

**Key rule:** `.env` always lives at the repo root. Never place it inside `apps/api/` or `apps/web/`.

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
PostgreSQL isn't reachable. Two possible causes:
- **Using Docker Postgres:** Check `docker compose ps` — the postgres service must show `healthy`.
- **Using local Postgres:** Verify your local Postgres is running (`pg_isready` or check your system's service manager) and that the `DB_*` values in `.env` match your local database credentials.

**`docker compose up` fails with "port 5432 already in use"**
The Docker postgres service now maps to host port **5433** to avoid this conflict. If you still see this error, another service is on 5433 — either change the port in `docker-compose.yml` or use Option B (local Postgres) instead.

**`sequelize-cli` command not found**
Run it via npx: `npx sequelize-cli db:migrate`

**API starts but crashes immediately**
Check that `.env` exists in the repo root (not inside `apps/api/`). The API resolves the `.env` path relative to `app.js`'s own location — it always expects the file two directories up at `personal-accountant/.env`.

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
