/**
 * Repository controller — handles GitHub ingestion endpoints.
 *
 * POST /api/repositories  — start ingesting a GitHub repo
 * GET  /api/repositories/:id — fetch ingestion status
 */

const { parse } = require('../utils/githubUrlParser');
const { validateRepo } = require('../services/githubService');
const { ingestRepository } = require('../services/ingestionService');
const Repository = require('../models/Repository');

const PLACEHOLDER_USER_ID = 1;

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

module.exports = { createRepository, getRepository };
