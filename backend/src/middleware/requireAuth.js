/**
 * requireAuth — Clerk session gate for protected routes.
 *
 * Uses `clerkMiddleware` to populate req.auth, then checks `getAuth(req).userId`
 * and returns a clean 401 JSON for API consumers (instead of the default
 * 302 redirect that `requireAuth()` would issue, which is browser-oriented).
 *
 * On success, ensures a `users` row exists for the Clerk userId (lazy mirror
 * from sessionClaims) and attaches it to req.user.
 *
 * NOTE: All Clerk fields passed to the model are explicitly defaulted to
 * `null` (never `undefined`) because mysql2 rejects undefined bind values.
 */

const { getAuth } = require('@clerk/express');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    const { userId, sessionClaims } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Unauthenticated',
      });
    }

    const claims = sessionClaims || {};
    const email = claims.email ?? null;
    const composedName = [claims.given_name, claims.family_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const name = claims.name ?? (composedName || null);

    const user = await User.ensureFromClerk({
      id: userId,
      email,
      name,
    });

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = requireAuth;