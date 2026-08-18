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

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

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
};

module.exports = config;
