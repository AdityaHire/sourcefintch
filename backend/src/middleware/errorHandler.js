/**
 * Centralized error handler — the LAST middleware Express calls when any
 * route or middleware passes an error via `next(err)`.
 *
 * HOW IT WORKS:
 * Express recognises middleware with 4 parameters (err, req, res, next) as
 * an error handler. When you call `next(new Error('boom'))` anywhere in a
 * route, Express skips all normal middleware and jumps straight here.
 */

const config = require('../config/environment');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log the full error in development for debugging
  if (config.nodeEnv === 'development') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${statusCode}`, err);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    // Only include the stack trace in development — never leak it in production
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
