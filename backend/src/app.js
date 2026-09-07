/**
 * Express application setup.
 *
 * This file creates and configures the Express app but does NOT start the
 * server.  Keeping app creation separate from `listen()` is a best practice
 * because it lets you import the app in tests without binding to a port.
 *
 * Middleware order matters in Express:
 *   1. Body parsing (express.json)       — so req.body is available
 *   2. CORS                              — so cross-origin requests work
 *   3. Application routes                — your actual endpoints
 *   4. 404 handler                       — catches unmatched routes
 *   5. Error handler                     — catches errors thrown in routes
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/environment');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const clerkAuth = require('./middleware/clerkMiddleware');

const app = express();

// ── 0. Clerk (must come BEFORE routes so req.auth is populated) ────────
app.use(clerkAuth);

// ── 1. Body parsing ────────────────────────────────
app.use(express.json());

// ── 2. CORS ────────────────────────────────────────
// `config.corsOrigin` may be a string, an array, or contain wildcard
// patterns like `https://*.vercel.app`.  The `cors` package doesn't
// understand wildcards, so we normalize the list into exact origins and
// a list of wildcard patterns, then use a custom `origin` function.
const rawOrigins = Array.isArray(config.corsOrigin)
  ? config.corsOrigin
  : [config.corsOrigin];

const exactOrigins = [];
const wildcardPatterns = [];

for (const entry of rawOrigins) {
  if (typeof entry !== 'string') continue;
  if (entry.includes('*')) {
    // Convert `https://*.vercel.app` into a regex: ^https://[^/]+\.vercel\.app$
    const escaped = entry
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials
      .replace(/\*/g, '.*'); // wildcard -> .*
    wildcardPatterns.push(new RegExp(`^${escaped}$`));
  } else {
    exactOrigins.push(entry);
  }
}

function isOriginAllowed(origin) {
  if (!origin) return false; // same-origin / server-to-server have no Origin
  if (exactOrigins.includes(origin)) return true;
  return wildcardPatterns.some((re) => re.test(origin));
}

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin and server-to-server calls (no Origin header).
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

// ── 3. Application routes (all prefixed with /api) ─
app.use('/api', routes);

// ── 4. 404 catch-all ───────────────────────────────
app.use(notFound);

// ── 5. Centralized error handler ───────────────────
app.use(errorHandler);

module.exports = app;
