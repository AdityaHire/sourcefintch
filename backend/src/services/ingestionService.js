/**
 * Ingestion service — clones a GitHub repo, scans files, and records them
 * in the database.
 *
 * This is a background task.  It updates `repositories.status` at each step
 * so the progress is visible even if the server restarts mid-clone.
 *
 * The temp clone directory is always cleaned up via try/finally.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const config = require('../config/environment');
const { pool } = require('../config/database');
const File = require('../models/File');
const Repository = require('../models/Repository');

const IGNORED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'vendor',
  'venv',
  '.venv',
  'env',
  '.env',
  '__pycache__',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.yarn',
  '.cache',
  '.gradle',
  '.idea',
  '.vscode',
  'pods',
  'DerivedData',
  '.terraform',
  '.docusaurus',
  'tmp',
  'temp',
]);

const IGNORED_FILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'cargo.lock',
  'gemfile.lock',
  'poetry.lock',
  'composer.lock',
  'bun.lockb',
  'flake.lock',
]);

const IGNORED_FILE_PATTERNS = [
  /^\.env(\.|$)/i,
  /\.lock$/i,
  /\.log$/i,
  /\.min\.(js|css)$/i,
  /\.bundle\.(js|css)$/i,
  /\.chunk\.(js|css)$/i,
  /\.map$/i,
  /\.d\.ts\.map$/i,
  /\.wasm$/i,
  /\.snap$/i,
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.svg', '.webp',
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.flac',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.pyc', '.class', '.o', '.map', '.wasm', '.ttf', '.woff', '.woff2', '.eot', '.cur', '.psd',
]);

const MAX_INGESTION_FILE_BYTES = 250 * 1024; // 250 KB max per file (skips massive bundles/dumps)

const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.m': 'objective-c',
  '.mm': 'objective-c',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.xml': 'xml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.ps1': 'powershell',
  '.lua': 'lua',
  '.r': 'r',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.ml': 'ocaml',
  '.clj': 'clojure',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',
};

const shouldIgnoreFile = (fileName) => {
  const lower = fileName.toLowerCase();
  if (IGNORED_FILE_NAMES.has(lower)) return true;
  for (const pattern of IGNORED_FILE_PATTERNS) {
    if (pattern.test(fileName)) return true;
  }
  const ext = path.extname(fileName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return false;
};

const detectLanguage = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
};

const createTempDir = () => {
  const base = path.join(os.tmpdir(), `sourcefinch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(base, { recursive: true });
  return base;
};

const updateStatus = async (repositoryId, status, extra = {}) => {
  await Repository.update(repositoryId, { status, ...extra });
};

const processFiles = async (repositoryId, cloneDir) => {
  const filesToInsert = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        if (shouldIgnoreFile(entry.name)) {
          continue;
        }

        let stats;
        try {
          stats = fs.statSync(fullPath);
        } catch {
          continue;
        }

        const maxBytes = Math.min(
          config.ingestion.maxFileSizeBytes || MAX_INGESTION_FILE_BYTES,
          MAX_INGESTION_FILE_BYTES
        );
        if (stats.size > maxBytes || stats.size === 0) {
          continue;
        }

        const relativePath = path.relative(cloneDir, fullPath).replace(/\\/g, '/');

        filesToInsert.push({
          repositoryId,
          filePath: relativePath,
          language: detectLanguage(entry.name),
          fileSize: stats.size,
        });
      }
    }
  };

  walk(cloneDir);

  if (filesToInsert.length > 0) {
    await File.createMany(filesToInsert);
  }

  return filesToInsert.length;
};

/**
 * Ingest a repository into the database.
 *
 * This function is designed to be called as a fire-and-forget background
 * task.  It catches its own errors and updates the repository status to
 * 'failed' if anything goes wrong.
 */
const ingestRepository = async (repositoryId, githubUrl, branch) => {
  const cloneDir = createTempDir();

  try {
    await updateStatus(repositoryId, 'cloning');

    await execFileAsync('git', [
      'clone',
      '--depth', '1',
      '--branch', branch,
      githubUrl,
      cloneDir,
    ], {
      timeout: config.ingestion.cloneTimeoutMs,
      windowsHide: true,
    });

    await updateStatus(repositoryId, 'scanning');
    const fileCount = await processFiles(repositoryId, cloneDir);

    await updateStatus(repositoryId, 'storing', { file_count: fileCount });

    // ── Trigger AI service parsing (fire-and-forget) ──────────────────
    // Node's job is done — kick off the Python AI service to parse and
    // chunk the code.  We don't await the result; Python processes in the
    // background.  The AbortController timeout (10s) only bounds how long
    // we wait to *establish* the connection, not Python's processing time.
    const triggerController = new AbortController();
    const triggerTimeout = setTimeout(() => triggerController.abort(), 120_000);

    fetch(`${config.aiServiceUrl}/ai/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repository_id: repositoryId, github_url: githubUrl, branch }),
      signal: triggerController.signal,
    })
      .then(() => {
        console.log(`[ingestion] AI parse triggered for repository ${repositoryId}`);
      })
      .catch((triggerErr) => {
        // Defensive: log but never crash — ingestion is already complete.
        console.error(`[ingestion] Failed to trigger AI parse for repository ${repositoryId}:`, triggerErr.message);
      })
      .finally(() => {
        clearTimeout(triggerTimeout);
      });
  } catch (error) {
    await updateStatus(repositoryId, 'failed');
    throw error;
  } finally {
    // Always clean up the temp directory, even on timeout or other errors.
    try {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; don't throw from finally.
    }
  }
};

module.exports = { ingestRepository };
