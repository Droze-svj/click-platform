// PM2 Ecosystem Configuration for Staging

module.exports = {
  apps: [
    {
      name: 'click-api-staging',
      script: './server/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 5002,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5002,
      },
      // Logging
      error_file: './logs/staging/pm2-error.log',
      out_file: './logs/staging/pm2-out.log',
      log_file: './logs/staging/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
    },
    // Optional: Separate worker for background jobs
    {
      name: 'click-worker-staging',
      script: './server/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
      },
      error_file: './logs/staging/worker-error.log',
      out_file: './logs/staging/worker-out.log',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};


