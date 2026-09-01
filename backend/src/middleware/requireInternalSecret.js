/**
 * requireInternalSecret — service-to-service authentication.
 *
 * Used by routes that the Python AI service calls.  The shared secret
 * travels in the `x-internal-secret` header and must match
 * INTERNAL_API_SECRET in the backend .env.  Fail-closed: if the secret
 * is unset on the server, all internal calls are rejected with 401.
 */

const config = require('../config/environment');

const requireInternalSecret = (req, res, next) => {
  const expected = config.internalApiSecret;
  if (!expected) {
    return res
      .status(401)
      .json({ status: 'error', message: 'Internal API secret not configured' });
  }

  const provided = req.header('x-internal-secret');
  if (provided !== expected) {
    return res
      .status(401)
      .json({ status: 'error', message: 'Invalid or missing internal secret' });
  }

  return next();
};

module.exports = requireInternalSecret;