import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(__dirname, '../api');

// The API's own server.js loads the repo-root .env itself, but this config
// process (and the `setup` project, which logs in over HTTP) needs
// ADMIN_PASSWORD too. Node 20.6+ ships a built-in .env loader, so no extra
// dependency is needed. Safe to call even if the vars are already set.
try {
  process.loadEnvFile(resolve(__dirname, '../../.env'));
} catch {
  // Already loaded, or no .env present (e.g. CI supplies real env vars) — fine.
}

const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Runs first: logs in via the API and writes storageState for the
    // real project to reuse. Depends on the webServers below being up.
    {
      name: 'setup',
      testMatch: /global\.setup\.js/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: resolve(__dirname, 'e2e/.auth/user.json'),
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'node server.js',
      cwd: apiDir,
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
