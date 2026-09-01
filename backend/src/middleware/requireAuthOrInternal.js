/**
 * requireAuthOrInternal — dual-mode auth for routes called by BOTH the
 * authenticated frontend AND the internal AI service.
 *
 * Three branches:
 *   1. Authenticated user → enforce ownership downstream.
 *   2. Valid x-internal-secret → allow (service call).
 *   3. Neither → reject with 401 (no anonymous read access).
 *
 * This intentionally does NOT skip the ownership check for branch 3 — the
 * route handler is responsible for verifying ownership when req.auth is
 * present.  Skipping auth entirely would leak data to any unauthenticated
 * caller.
 */

const { getAuth } = require('@clerk/express');
const config = require('../config/environment');

const requireAuthOrInternal = (req, res, next) => {
  // `req.auth` is a function in Clerk v1+ — always call `getAuth(req)`.
  if (getAuth(req)?.userId) return next();

  const expected = config.internalApiSecret;
  const provided = req.header('x-internal-secret');
  if (expected && provided === expected) return next();

  return res.status(401).json({
    status: 'error',
    message: 'Authentication required (user session or internal secret)',
  });
};

module.exports = requireAuthOrInternal;