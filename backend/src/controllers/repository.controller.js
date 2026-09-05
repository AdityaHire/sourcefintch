/**
 * Repository controller — handles GitHub ingestion endpoints.
 *
 * Auth source: req.auth.userId (Clerk) set by requireAuth middleware.
 * Internal calls (AI service) reach GET /:id via x-internal-secret and
 * must NOT pass ownership checks.
 */

const path = require('path');
const fs = require('fs');
const { parse } = require('../utils/githubUrlParser');
const { validateRepo } = require('../services/githubService');
const { ingestRepository } = require('../services/ingestionService');
const Repository = require('../models/Repository');
const File = require('../models/File');
const CodeChunk = require('../models/CodeChunk');
const { getAuth } = require('@clerk/express');
const config = require('../config/environment');

// In-memory cache for intelligence reports: repository_id -> { report, timestamp }
const reportCache = new Map();

const VALID_STATUSES = [
  'pending',
  'cloning',
  'scanning',
  'storing',
  'embedding',
  'completed',
  'failed',
];

// `req.auth` is a function (Clerk v1+ API), not a plain object.  Always
// call `getAuth(req)` to read `userId` / `sessionClaims`.  This helper
// returns the current Clerk userId or null.
const userId = (req) => getAuth(req)?.userId ?? null;

const createRepository = async (req, res, next) => {
  try {
    const { github_url, branch } = req.body;
    const currentUserId = userId(req);

    if (!github_url || typeof github_url !== 'string') {
      const err = new Error('github_url is required');
      err.statusCode = 400;
      throw err;
    }

    const { owner, repo } = parse(github_url);

    const repoInfo = await validateRepo(owner, repo);

    // Auto-fail any repos that have been "in progress" longer than the
    // configured threshold.  This handles cases where the AI service
    // crashed or the network blipped, leaving a repo stuck in a non-terminal
    // state forever.
    try {
      const expired = await Repository.expireStuckRepositories();
      if (expired > 0) {
        console.log(`[repositories] Auto-failed ${expired} stuck ingestion(s).`);
      }
    } catch (e) {
      console.warn('[repositories] expireStuckRepositories failed:', e.message);
    }

    const activeRepos = await Repository.findActiveByUserId(currentUserId);
    if (activeRepos.length > 0) {
      // A 'pending' row that never moved to 'cloning' usually means the
      // worker never picked it up (process died during deploy/restart).
      // Delete it and proceed so the user isn't stuck.
      const orphan = activeRepos.find((r) => r.status === 'pending');
      if (orphan) {
        console.log(
          `[repositories] Removing orphan pending repo ${orphan.id} (never picked up)`
        );
        await Repository.remove(orphan.id);
      } else {
        const err = new Error(
          'You already have a repository in progress. Please wait for it to complete.'
        );
        err.statusCode = 429;
        throw err;
      }
    }

    const repository = await Repository.create({
      userId: currentUserId,
      name: repoInfo.name,
      owner,
      githubUrl: github_url,
      branch: branch || repoInfo.defaultBranch || 'main',
    });

    ingestRepository(repository.id, github_url, repository.branch).catch((err) => {
      console.error(`[ingestion] Repository ${repository.id} failed:`, err);
    });

    res.status(201).json({
      id: repository.id,
      name: repository.name,
      status: repository.status,
    });
  } catch (error) {
    next(error);
  }
};

const getRepository = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await Repository.findById(id);

    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check for authenticated callers.  Internal AI-service calls
    // (`getAuth(req).userId` falsy when middleware passed via x-internal-secret)
    // are allowed through.
    const currentUserId = userId(req);
    if (currentUserId && repository.user_id !== currentUserId) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    res.json(repository);
  } catch (error) {
    next(error);
  }
};

const getRepositoryFiles = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await Repository.findById(id);

    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    const files = await File.findByRepositoryId(id);
    res.json(files);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/repositories/:id/files/:fileId
 * Fetch a single file's full content (lazy-loaded by the CodeViewer).
 * Automatically resolves missing content from GitHub raw if the repo was
 * ingested prior to full-text storage, and caches it back to the database.
 */
const getFileContent = async (req, res, next) => {
  try {
    const { id, fileId } = req.params;
    let file = null;

    if (/^\d+$/.test(fileId)) {
      file = await File.findById(fileId);
    } else {
      file = await File.findByRepoAndPath(id, decodeURIComponent(fileId));
    }

    if (!file || String(file.repository_id) !== String(id)) {
      const err = new Error('File not found');
      err.statusCode = 404;
      throw err;
    }

    // If file content is missing (e.g. repos ingested before content was stored), fetch & self-heal
    if (!file.content) {
      // 1. Try GitHub raw fetch
      try {
        const repository = await Repository.findById(id);
        if (repository && repository.github_url) {
          const { owner, repo } = parse(repository.github_url);
          const branch = repository.branch || 'main';
          if (owner && repo) {
            const cleanPath = file.file_path.replace(/^\/+/, '');
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
            let resp = await fetch(rawUrl, {
              headers: { 'User-Agent': 'Sourcefintch-CodeViewer' },
            });

            // If not found and branch was main or master, try the alternate branch name
            if (!resp.ok && (branch === 'main' || branch === 'master')) {
              const altBranch = branch === 'main' ? 'master' : 'main';
              const altUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${altBranch}/${cleanPath}`;
              const altResp = await fetch(altUrl, {
                headers: { 'User-Agent': 'Sourcefintch-CodeViewer' },
              });
              if (altResp.ok) {
                resp = altResp;
              }
            }

            if (resp && resp.ok) {
              const text = await resp.text();
              file.content = text;
              await File.updateContent(file.id, text);
            }
          }
        }
      } catch (rawErr) {
        console.warn(`[getFileContent] Could not fetch raw content from GitHub: ${rawErr.message}`);
      }

      // 2. Fallback to local workspace if running against current project repo
      if (!file.content) {
        try {
          const localPath = path.resolve(process.cwd(), file.file_path);
          if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            const localText = fs.readFileSync(localPath, 'utf8');
            file.content = localText;
            await File.updateContent(file.id, localText);
          }
        } catch (localErr) {
          // ignore
        }
      }
    }

    res.json(file);
  } catch (error) {
    next(error);
  }
};

const updateRepositoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      const err = new Error(
        `Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }

    const repository = await Repository.findById(id);
    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await Repository.update(id, { status });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteRepositoryChunks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await Repository.findById(id);

    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    const deletedCount = await CodeChunk.deleteByRepositoryId(id);
    res.json({
      repository_id: Number(id),
      deleted_chunks: deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

const listCompletedRepositories = async (req, res, next) => {
  try {
    const repos = await Repository.findCompletedByUserId(userId(req));
    res.json(repos);
  } catch (error) {
    next(error);
  }
};

const deleteRepository = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = userId(req);
    const repository = await Repository.findById(id);

    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    if (repository.user_id !== currentUserId) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    try {
      await CodeChunk.deleteByRepositoryId(id);
    } catch {
      // Ignore if no chunks
    }

    reportCache.delete(Number(id));
    await Repository.remove(id);
    res.json({
      success: true,
      message: 'Repository deleted successfully',
      id: Number(id),
    });
  } catch (error) {
    next(error);
  }
};

const getRepositoryReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceRefresh = req.query.refresh === 'true' || req.body?.force_refresh === true;
    const repoIdNum = Number(id);

    // 1. Verify repository exists
    const repository = await Repository.findById(repoIdNum);
    if (!repository) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Check cached report if not forcing refresh
    if (!forceRefresh && reportCache.has(repoIdNum)) {
      return res.json(reportCache.get(repoIdNum).report);
    }

    // 3. Call AI Service to generate report
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 60000); // 60s timeout

    let aiResponse;
    try {
      aiResponse = await fetch(`${config.aiServiceUrl}/ai/repository/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_id: repoIdNum,
          force_refresh: forceRefresh,
        }),
        signal: abortController.signal,
      });

      if (aiResponse.ok) {
        const report = await aiResponse.json();
        reportCache.set(repoIdNum, { report, timestamp: Date.now() });
        return res.json(report);
      }
      console.warn(`[report] AI service returned ${aiResponse.status}, generating fallback report`);
    } catch (networkErr) {
      console.warn(`[report] AI service unreachable (${networkErr.message}), generating fallback report`);
    } finally {
      clearTimeout(timeout);
    }

    // 4. Fallback: Generate report directly from stored repository files
    const files = await File.findByRepositoryId(repoIdNum);
    const fallbackReport = generateFallbackReport(repository, files);
    reportCache.set(repoIdNum, { report: fallbackReport, timestamp: Date.now() });
    res.json(fallbackReport);
  } catch (error) {
    next(error);
  }
};

const generateFallbackReport = (repository, files) => {
  const totalFiles = files.length;
  let totalBytes = 0;
  let totalLines = 0;
  const langCounts = {};
  const langLines = {};
  const entryPoints = [];
  const manifests = [];
  const dependencies = [];
  const detectedApis = [];
  const dirCounts = {};

  const extMap = {
    '.ts': 'TypeScript',
    '.tsx': 'TSX',
    '.js': 'JavaScript',
    '.jsx': 'JSX',
    '.py': 'Python',
    '.json': 'JSON',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sql': 'SQL',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
  };

  const colors = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3572a5',
    TSX: '#61dafb',
    JSX: '#20c997',
    HTML: '#e34c26',
    CSS: '#563d7c',
    JSON: '#cbcb41',
    Markdown: '#083fa1',
    SQL: '#e38c00',
    Go: '#00add8',
    Rust: '#dea584',
    Java: '#b07219',
    Other: '#71717a',
  };

  for (const f of files) {
    const path = f.file_path || '';
    const content = f.content || '';
    const size = f.file_size || (content ? Buffer.byteLength(content, 'utf8') : 0);
    const lines = content ? content.split('\n').length : 0;

    totalBytes += size;
    totalLines += lines;

    const parts = path.split('/');
    if (parts.length > 1) {
      dirCounts[parts[0]] = (dirCounts[parts[0]] || 0) + 1;
    }

    const ext = path.includes('.') ? '.' + path.split('.').pop().toLowerCase() : '';
    const lang = extMap[ext] || f.language || 'Other';
    langCounts[lang] = (langCounts[lang] || 0) + 1;
    langLines[lang] = (langLines[lang] || 0) + lines;

    const base = path.split('/').pop();
    if (['main.py', 'app.py', 'server.js', 'app.js', 'index.js', 'index.ts', 'main.ts', 'main.tsx', 'App.tsx'].includes(base)) {
      entryPoints.push({
        file_path: path,
        name: base,
        language: lang,
        description: `Primary application entry point (${lang})`,
      });
    }

    if (base === 'package.json') {
      manifests.push(path);
      try {
        const pkg = JSON.parse(content);
        if (pkg.dependencies) {
          Object.entries(pkg.dependencies).forEach(([name, ver]) => {
            dependencies.push({ name, version: ver, type: 'runtime', category: 'Framework & Runtime' });
          });
        }
        if (pkg.devDependencies) {
          Object.entries(pkg.devDependencies).forEach(([name, ver]) => {
            dependencies.push({ name, version: ver, type: 'dev', category: 'Utility & Tooling' });
          });
        }
      } catch {}
    } else if (base === 'requirements.txt') {
      manifests.push(path);
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/[><=~]+/);
          dependencies.push({ name: parts[0].trim(), version: parts[1]?.trim() || 'latest', type: 'runtime', category: 'Framework & Runtime' });
        }
      });
    }

    if (/router|route|api|controller/i.test(path)) {
      const matches = content.matchAll(/\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi);
      for (const m of matches) {
        detectedApis.push({ method: m[2].toUpperCase(), path: m[3], file: path });
      }
    }
  }

  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({
      language: lang,
      file_count: count,
      line_count: langLines[lang] || 0,
      byte_size: 0,
      percentage: Number(((count / Math.max(totalFiles, 1)) * 100).toFixed(1)),
      color: colors[lang] || colors.Other,
    }));

  const keyDirectories = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([d, count]) => ({
      path: d,
      file_count: count,
      description: `Core module containing ${count} files`,
    }));

  const topLangs = languages.slice(0, 3).map((l) => `${l.language} (${l.percentage}%)`).join(', ');

  return {
    repository_id: repository.id,
    repo_name: repository.name,
    owner: repository.owner || '',
    github_url: repository.github_url || '',
    branch: repository.branch || 'main',
    generated_at: new Date().toISOString(),
    metrics: {
      total_files: totalFiles,
      total_lines: totalLines,
      total_size_bytes: totalBytes,
      languages,
    },
    manifests,
    dependencies: dependencies.slice(0, 60),
    scripts: {},
    entry_points: entryPoints.slice(0, 8),
    key_directories: keyDirectories,
    detected_apis: detectedApis.slice(0, 25),
    ai_analysis: {
      executive_summary: `${repository.name} is a codebase structured across ${totalFiles} source files, built primarily with ${topLangs || 'modern technologies'}.`,
      architecture_style: 'Modular Multi-Tier Application',
      architecture_deep_dive: `### Architecture Overview\n\nThe repository \`${repository.name}\` is organized across ${totalFiles} source files and ${keyDirectories.length} primary directories. Key languages include ${topLangs}.\n\n### Subsystems & Components\n- **Entry Points**: ${entryPoints.map((e) => `\`${e.file_path}\``).join(', ') || 'Standard structure'}\n- **Dependencies**: ${dependencies.length} packages identified spanning runtime frameworks and development tooling.`,
      key_features: [
        { title: 'Modular Structure', description: `Organized into ${keyDirectories.length} distinct directories with clean separation of concerns.` },
        { title: 'Multi-Tier Ecosystem', description: `Powered by ${topLangs || 'modern web technologies'}.` },
      ],
      security_and_performance: [
        { aspect: 'Architecture', observation: 'Clean decoupling of source directories and entry points.' },
      ],
      onboarding_guide: [
        { step: 1, title: 'Inspect Entry Points', detail: `Review primary files: ${entryPoints.map((e) => e.file_path).slice(0, 2).join(', ') || 'root source files'}.` },
        { step: 2, title: 'Check Dependencies', detail: `Examine ${manifests.join(', ') || 'package manifests'} for required packages and build scripts.` },
      ],
      recommended_questions: [
        `How is the overall data flow structured in ${repository.name}?`,
        'What are the primary entry points and how do they start the application?',
        'Can you explain the main dependencies and their purposes?',
        'How do I add a new feature or endpoint to this project?',
      ],
    },
  };
};

module.exports = {
  listCompletedRepositories,
  createRepository,
  getRepository,
  getRepositoryFiles,
  getFileContent,
  getRepositoryReport,
  updateRepositoryStatus,
  deleteRepositoryChunks,
  deleteRepository,
};