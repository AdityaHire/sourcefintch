/**
 * Clerk authentication middleware — mounts globally in app.js BEFORE routes.
 *
 * `clerkMiddleware` parses the incoming session JWT (sent from the frontend
 * via `Authorization: Bearer <token>`) and exposes `getAuth(req)` returning:
 *   - userId        (Clerk userId, e.g. "user_2abc...")
 *   - sessionClaims (object with email, name, etc.)
 *
 * In `@clerk/express` v1+, `req.auth` is a FUNCTION — always call it via
 * `getAuth(req)` rather than reading `req.auth.userId` directly.
 *
 * This middleware does NOT reject unauthenticated requests; route-level
 * `requireAuth` / `requireAuthOrInternal` does that.
 */

const { clerkMiddleware } = require('@clerk/express');
const config = require('../config/environment');

module.exports = clerkMiddleware({
  secretKey: config.clerk.secretKey,
  publishableKey: config.clerk.publishableKey,
});