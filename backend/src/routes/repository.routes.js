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
const {
  listCompletedRepositories,
  createRepository,
  getRepository,
  getRepositoryFiles,
  updateRepositoryStatus,
  deleteRepositoryChunks,
  deleteRepository,
} = require('../controllers/repository.controller');

const router = Router();

// GET /api/repositories — list completed repositories for the signed-in user
router.get('/', requireAuth, listCompletedRepositories);

// POST /api/repositories — start ingestion
router.post('/', requireAuth, createRepository);

// GET /api/repositories/:id — frontend status polling AND AI service lookup
router.get('/:id', requireAuthOrInternal, getRepository);

// DELETE /api/repositories/:id
router.delete('/:id', requireAuth, deleteRepository);

// GET /api/repositories/:id/files — AI service only
router.get('/:id/files', requireInternalSecret, getRepositoryFiles);

// PATCH /api/repositories/:id/status — AI service only
router.patch('/:id/status', requireInternalSecret, updateRepositoryStatus);

// DELETE /api/repositories/:id/chunks — AI service only
router.delete('/:id/chunks', requireInternalSecret, deleteRepositoryChunks);

module.exports = router;