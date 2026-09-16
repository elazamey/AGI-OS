// ============================================================================
// AGI OS — PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'agi-dashboard',
      script: 'pnpm',
      args: '--filter @agi-os/dashboard start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        MAX_SPEND: '0',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
