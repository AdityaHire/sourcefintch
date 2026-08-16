/**
 * GitHub metadata service — fetches repo information from the GitHub REST API.
 *
 * This service does NOT fetch file contents. It only retrieves metadata needed
 * to decide whether to clone a repo (public? size? default branch?).
 */

const config = require('../config/environment');

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Fetch repository metadata from GitHub.
 * Returns an object with the fields we care about.
 */
const getRepoInfo = async (owner, repo) => {
  const headers = {
    Accept: 'application/vnd.github+json',
  };

  if (config.github.token) {
    headers.Authorization = `Bearer ${config.github.token}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }
    if (response.status === 401) {
      const err = new Error('Invalid GitHub token');
      err.statusCode = 401;
      throw err;
    }
    const text = await response.text();
    const err = new Error(`GitHub API error (${response.status}): ${text}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await response.json();

  return {
    name: data.name,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    sizeKb: data.size,
    isPrivate: data.private,
    htmlUrl: data.html_url,
  };
};

/**
 * Validate that a repo is public and within size limits.
 * Throws with a user-facing message if validation fails.
 */
const validateRepo = async (owner, repo) => {
  const info = await getRepoInfo(owner, repo);

  if (info.isPrivate) {
    const err = new Error('Private repositories are not supported yet. Please use a public repo.');
    err.statusCode = 400;
    throw err;
  }

  if (info.sizeKb > config.ingestion.maxRepoSizeKb) {
    const err = new Error(
      `Repository is too large (${info.sizeKb} KB). ` +
        `Maximum allowed size is ${config.ingestion.maxRepoSizeKb} KB (~${Math.round(config.ingestion.maxRepoSizeKb / 1024)} MB).`
    );
    err.statusCode = 400;
    throw err;
  }

  return info;
};

module.exports = { getRepoInfo, validateRepo };
