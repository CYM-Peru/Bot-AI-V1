require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'bot-ai',
      script: 'npm',
      args: 'run dev:server',
      cwd: '/opt/flow-builder',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        // Cargar todas las variables del .env
        ...process.env,
      },
      error_file: '/opt/flow-builder/logs/error.log',
      out_file: '/opt/flow-builder/logs/out.log',
      log_file: '/opt/flow-builder/logs/combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};
