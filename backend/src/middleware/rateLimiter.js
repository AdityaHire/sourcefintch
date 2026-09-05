/**
 * Rate limiting middleware — protects expensive endpoints from abuse.
 *
 * Uses `express-rate-limit` with Clerk userId key fallback to IP.
 * Standard response shape matches Sourcefinch error format:
 *   { status: 'error', statusCode: 429, message: '...' }
 */

const rateLimit = require('express-rate-limit');
const { getAuth } = require('@clerk/express');

const keyGenerator = (req) => {
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) return auth.userId;
  } catch {
    // Failsafe if getAuth throws
  }
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
};

const customHandler = (message) => (req, res) => {
  res.status(429).json({
    status: 'error',
    statusCode: 429,
    message,
  });
};

/**
 * Chat Rate Limiter: Max 30 messages per minute per user/IP.
 */
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: customHandler('Too many chat requests. Please wait a moment before sending another message.'),
});

/**
 * Ingestion Rate Limiter: Max 10 repository ingestion jobs per 15 minutes per user/IP.
 */
const ingestionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: customHandler('Too many repository ingestion requests. Please wait a few minutes before adding another repository.'),
});

/**
 * General API Rate Limiter: Max 150 requests per minute.
 */
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: customHandler('Too many requests. Please slow down.'),
});

module.exports = {
  chatRateLimiter,
  ingestionRateLimiter,
  generalRateLimiter,
};
