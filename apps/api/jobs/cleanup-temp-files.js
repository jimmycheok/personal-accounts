import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../config/storage.js';

export function defineCleanupTempFilesJob(agenda) {
  agenda.define('cleanup-temp-files', async (job) => {
    const tempDir = path.join(UPLOAD_DIR, 'temp');
    if (!fs.existsSync(tempDir)) return;

    const files = fs.readdirSync(tempDir);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (err) {
        // Ignore stat/unlink errors
      }
    }

    console.log(`[cleanup-temp-files] Deleted ${deleted} temp files older than 24h`);
  });
}
