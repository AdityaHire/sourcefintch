/**
 * GitHub URL parser — validates and extracts owner/repo from a GitHub URL.
 *
 * ACCEPTED FORMS:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo.git/
 *   http://github.com/owner/repo
 *
 * REJECTS:
 *   - Non-GitHub hosts (gitlab.com, bitbucket.org, etc.)
 *   - URLs without an owner/repo path
 *   - URLs with extra path segments beyond owner/repo (e.g. /owner/repo/issues)
 */

const GITHUB_HOST_RE = /^github\.com$/i;

const parse = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!GITHUB_HOST_RE.test(parsed.hostname)) {
    throw new Error('URL must be from github.com');
  }

  const pathParts = parsed.pathname.replace(/^\/|\/$/g, '').split('/');

  if (pathParts.length < 2) {
    throw new Error('URL must include owner and repository');
  }

  const [owner, repo] = pathParts;

  if (!owner || !repo) {
    throw new Error('URL must include owner and repository');
  }

  const cleanRepo = repo.replace(/\.git$/i, '');

  return { owner, repo: cleanRepo };
};

module.exports = { parse };
