// Entry point — loads .env BEFORE any other module runs, then starts the app.
// ES module static imports are hoisted, so dotenv must be called here via
// a dynamic import to guarantee env vars are set before services read them.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

await import('./app.js');
