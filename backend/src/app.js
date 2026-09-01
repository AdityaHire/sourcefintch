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
app.use(
  cors({
    origin: config.corsOrigin,
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
