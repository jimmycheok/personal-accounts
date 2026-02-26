// PM2 process manager configuration
// Usage:
//   pm2 start ecosystem.config.cjs            # start with .env
//   pm2 start ecosystem.config.cjs --env prod # start with prod env block below
//   pm2 save && pm2 startup                   # auto-start on server reboot

module.exports = {
  apps: [
    {
      name: 'pa-api',
      script: 'apps/api/app.js',
      cwd: __dirname,           // always runs from repo root

      // PM2 loads .env and injects vars into process.env before the app starts.
      // dotenv inside app.js will then skip any vars already set (no override).
      env_file: '.env',

      // Node options for ESM support
      node_args: '--experimental-vm-modules',

      // Restart policy
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,

      // Logs
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
