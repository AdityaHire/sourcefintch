/**
 * Repository routes — maps HTTP verbs + paths to controller functions.
 *
 * Auth rules:
 *   - GET/POST /                     → requireAuth (frontend)
 *   - DELETE /:id                    → requireAuth (frontend)
 *   - GET /:id                       → requireAuthOrInternal (frontend + AI service)
 *   - GET /:id/files                 → requireInternalSecret (AI service only)
 *   - PATCH /:id/status              → requireInternalSecret (AI service only)
 *   - DELETE /:id/chunks             → requireInternalSecret (AI service only)
 */

const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireInternalSecret = require('../middleware/requireInternalSecret');
const requireAuthOrInternal = require('../middleware/requireAuthOrInternal');
const { ingestionRateLimiter } = require('../middleware/rateLimiter');
const {
  listCompletedRepositories,
  createRepository,
  getRepository,
  getRepositoryFiles,
  getFileContent,
  getRepositoryReport,
  updateRepositoryStatus,
  deleteRepositoryChunks,
  deleteRepository,
} = require('../controllers/repository.controller');

const router = Router();

// GET /api/repositories — list completed repositories for the signed-in user
router.get('/', requireAuth, listCompletedRepositories);

// POST /api/repositories — start ingestion (rate limited)
router.post('/', requireAuth, ingestionRateLimiter, createRepository);

// GET /api/repositories/:id — frontend status polling AND AI service lookup
router.get('/:id', requireAuthOrInternal, getRepository);

// DELETE /api/repositories/:id
router.delete('/:id', requireAuth, deleteRepository);

// GET /api/repositories/:id/files — File list (metadata only, no content)
router.get('/:id/files', requireAuthOrInternal, getRepositoryFiles);

// GET /api/repositories/:id/files/:fileId — Single file with full content
router.get('/:id/files/:fileId', requireAuthOrInternal, getFileContent);

// GET & POST /api/repositories/:id/report — Full Repository Intelligence Report
router.get('/:id/report', requireAuthOrInternal, getRepositoryReport);
router.post('/:id/report', requireAuthOrInternal, getRepositoryReport);

// PATCH /api/repositories/:id/status — AI service only
router.patch('/:id/status', requireInternalSecret, updateRepositoryStatus);

// DELETE /api/repositories/:id/chunks — AI service only
router.delete('/:id/chunks', requireInternalSecret, deleteRepositoryChunks);

module.exports = router;