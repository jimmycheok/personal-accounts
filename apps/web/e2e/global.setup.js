import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.resolve(__dirname, '.auth/user.json');

// Authenticates the way the app itself does — POST /auth/login — but never
// through the login form, and never logs or hardcodes the password. The
// resulting JWT is written into a Playwright storageState file so every
// other spec starts already signed in, with `pa_token` present in
// localStorage exactly as AuthContext expects it.
setup('authenticate', async ({ request, baseURL }) => {
  const password = process.env.ADMIN_PASSWORD;
  expect(password, 'ADMIN_PASSWORD must be set in the environment (see repo-root .env)').toBeTruthy();

  const apiURL = process.env.E2E_API_URL || 'http://localhost:3001';
  const res = await request.post(`${apiURL}/api/v1/auth/login`, {
    data: { password },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const { token } = await res.json();
  expect(token).toBeTruthy();

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(
    authFile,
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin: baseURL || 'http://localhost:5173',
            localStorage: [{ name: 'pa_token', value: token }],
          },
        ],
      },
      null,
      2,
    ),
  );
});
