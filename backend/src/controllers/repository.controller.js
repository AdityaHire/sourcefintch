/**
 * Repository controller — handles GitHub ingestion endpoints.
 *
 * Auth source: req.auth.userId (Clerk) set by requireAuth middleware.
 * Internal calls (AI service) reach GET /:id via x-internal-secret and
 * must NOT pass ownership checks.
 */

const { parse } = require('../utils/githubUrlParser');
const { validateRepo } = require('../services/githubService');
const { ingestRepository } = require('../services/ingestionService');
const Repository = require('../models/Repository');
const File = require('../models/File');
const CodeChunk = require('../models/CodeChunk');
const { getAuth } = require('@clerk/express');

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

module.exports = {
  listCompletedRepositories,
  createRepository,
  getRepository,
  getRepositoryFiles,
  updateRepositoryStatus,
  deleteRepositoryChunks,
  deleteRepository,
};