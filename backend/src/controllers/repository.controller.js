/**
 * Repository controller — handles GitHub ingestion endpoints.
 *
 * POST /api/repositories      — start ingesting a GitHub repo
 * GET  /api/repositories/:id  — fetch ingestion status
 * GET  /api/repositories/:id/files — fetch stored file list
 */

const { parse } = require('../utils/githubUrlParser');
const { validateRepo } = require('../services/githubService');
const { ingestRepository } = require('../services/ingestionService');
const Repository = require('../models/Repository');
const File = require('../models/File');
const CodeChunk = require('../models/CodeChunk');

const PLACEHOLDER_USER_ID = 1;

const VALID_STATUSES = [
  'pending',
  'cloning',
  'scanning',
  'storing',
  'embedding',
  'completed',
  'failed',
];

const createRepository = async (req, res, next) => {
  try {
    const { github_url, branch } = req.body;

    if (!github_url || typeof github_url !== 'string') {
      const err = new Error('github_url is required');
      err.statusCode = 400;
      throw err;
    }

    const { owner, repo } = parse(github_url);

    const repoInfo = await validateRepo(owner, repo);

    const activeRepos = await Repository.findActiveByUserId(PLACEHOLDER_USER_ID);
    if (activeRepos.length > 0) {
      const err = new Error('You already have a repository in progress. Please wait for it to complete.');
      err.statusCode = 429;
      throw err;
    }

    const repository = await Repository.create({
      userId: PLACEHOLDER_USER_ID,
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

    res.json(repository);
  } catch (error) {
    next(error);
  }
};

/**
 * Return the list of files stored for a repository.
 *
 * The Python AI service calls this to learn exactly which files to parse.
 * The list comes from MySQL (populated during Phase 3 ingestion), so it
 * already reflects all Node-side filtering (ignored dirs, binary extensions,
 * size limits, symlink exclusion).  Python trusts this list rather than
 * re-implementing filtering rules.
 */
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
 * Internal status update endpoint — called by the Python AI service
 * to advance status through 'embedding' -> 'completed' (or 'failed').
 */
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

/**
 * Internal chunk cleanup endpoint — called by the Python AI service
 * before re-indexing or during compensating rollback on upsert failure.
 */
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

/**
 * List all completed repositories.
 * Used by the frontend repository selector.
 */
const listCompletedRepositories = async (req, res, next) => {
  try {
    const repos = await Repository.findCompleted();
    res.json(repos);
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
};

