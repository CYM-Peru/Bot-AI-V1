module.exports = {
  apps: [
    {
      name: 'bot-ai-backend',
      script: 'npm',
      args: 'run dev:server',
      cwd: '/home/user/Bot-AI-V1',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/user/Bot-AI-V1/logs/error.log',
      out_file: '/home/user/Bot-AI-V1/logs/out.log',
      log_file: '/home/user/Bot-AI-V1/logs/combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};
