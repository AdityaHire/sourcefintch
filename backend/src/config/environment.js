/**
 * Centralized configuration — every env var the backend uses is loaded and
 * exported from this single file.  Importing `config` anywhere else gives
 * you a plain object with sensible defaults already applied.
 *
 * WHY: Scattering `process.env.X` across files makes it hard to know which
 * env vars exist, easy to typo a name, and impossible to validate at startup.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from the backend root (one level up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Parse CORS_ORIGIN into an array of allowed origins.
 *
 * Supports a comma-separated list so you can allow multiple origins
 * (e.g. production + preview/staging) in a single env var:
 *   CORS_ORIGIN=https://app.example.com,https://app-xyz.vercel.app
 *
 * Additionally, in non-production environments, any `*.vercel.app` origin
 * is auto-allowed so Vercel preview deployments never break the app again.
 */
function parseCorsOrigins(raw) {
  if (!raw) {
    return 'http://localhost:5173';
  }

  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    // Auto-allow every Vercel preview deployment during local/dev/staging.
    origins.push('https://*.vercel.app');
  }

  return origins.length === 1 ? origins[0] : origins;
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),

  // ── MySQL ──────────────────────────────────────────
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sourcefinch',
    ssl: process.env.MYSQL_SSL === 'true',
  },

  // ── GitHub ─────────────────────────────────────────
  github: {
    token: process.env.GITHUB_TOKEN || '',
  },

  // ── Ingestion limits ───────────────────────────────
  ingestion: {
    maxRepoSizeKb: Number.isNaN(parseInt(process.env.MAX_REPO_SIZE_KB, 10)) ? 50000 : parseInt(process.env.MAX_REPO_SIZE_KB, 10),
    maxFileSizeBytes: Number.isNaN(parseInt(process.env.MAX_FILE_SIZE_BYTES, 10)) ? 1048576 : parseInt(process.env.MAX_FILE_SIZE_BYTES, 10),
    cloneTimeoutMs: Number.isNaN(parseInt(process.env.CLONE_TIMEOUT_MS, 10)) ? 120000 : parseInt(process.env.CLONE_TIMEOUT_MS, 10),
  },

  // ── AI Service ────────────────────────────────────
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // ── Clerk Authentication ──────────────────────────
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  },

  // ── Internal API Secret ───────────────────────────
  // Shared with the Python AI service for server-to-server calls.
  // Must match INTERNAL_API_SECRET in ai-service/.env.
  internalApiSecret: process.env.INTERNAL_API_SECRET || '',
};

module.exports = config;