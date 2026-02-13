/**
 * PM2 Ecosystem Configuration - VocalIA Voice Platform
 *
 * Deployment: pm2 start ecosystem.config.cjs
 * Monitor: pm2 monit
 * Logs: pm2 logs
 *
 * Services:
 * - voice-api (3004): Multi-AI fallback voice responses
 * - grok-realtime (3007): WebSocket audio streaming
 * - telephony-bridge (3009): Twilio PSTN ↔ AI bridge
 * - db-api (3013): REST API + Auth
 */

module.exports = {
  apps: [
    // ==================
    // VOICE API (port 3004)
    // Primary voice response service
    // ==================
    {
      name: 'voice-api',
      script: 'core/voice-api-resilient.cjs',
      args: '--server --port=3004',
      cwd: '/var/www/vocalia',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      error_file: '/var/log/vocalia/voice-api-error.log',
      out_file: '/var/log/vocalia/voice-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ==================
    // GROK REALTIME (port 3007)
    // WebSocket audio streaming
    // ==================
    {
      name: 'grok-realtime',
      script: 'core/grok-voice-realtime.cjs',
      args: '--port=3007',
      cwd: '/var/www/vocalia',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3007
      },
      error_file: '/var/log/vocalia/grok-realtime-error.log',
      out_file: '/var/log/vocalia/grok-realtime-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ==================
    // TELEPHONY BRIDGE (port 3009)
    // Twilio PSTN ↔ AI Bridge
    // CRITICAL: This handles Twilio webhooks
    // ==================
    {
      name: 'telephony-bridge',
      script: 'telephony/voice-telephony-bridge.cjs',
      args: '--port=3009',
      cwd: '/var/www/vocalia',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
        // Twilio Credentials (from .env)
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER
      },
      error_file: '/var/log/vocalia/telephony-error.log',
      out_file: '/var/log/vocalia/telephony-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ==================
    // DB API (port 3013)
    // REST API + Authentication
    // ==================
    {
      name: 'db-api',
      script: 'core/db-api.cjs',
      args: '--port=3013',
      cwd: '/var/www/vocalia',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3013
      },
      error_file: '/var/log/vocalia/db-api-error.log',
      out_file: '/var/log/vocalia/db-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],

  deploy: {
    production: {
      user: 'vocalia',
      host: 'vps.vocalia.ma',
      ref: 'origin/main',
      repo: 'git@github.com:Jouiet/VocalIA.git',
      path: '/var/www/vocalia',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};
