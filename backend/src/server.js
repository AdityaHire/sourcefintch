/**
 * Server entry point — starts listening on the configured port.
 *
 * This is the only file that calls app.listen().  Everything else imports
 * the app from app.js without side effects.
 */

const app = require('./app');
const config = require('./config/environment');

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection:', reason);
});

const server = app.listen(config.port, () => {
  console.log(
    `\n🐦 Sourcefinch backend running → http://localhost:${config.port}` +
    `\n   Environment: ${config.nodeEnv}` +
    `\n   Health check: http://localhost:${config.port}/api/health\n`
  );
});

server.on('error', (err) => {
  console.error('[server] Server error:', err);
});
