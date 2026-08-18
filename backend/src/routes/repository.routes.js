/**
 * Repository routes — maps HTTP verbs + paths to controller functions.
 */

const { Router } = require('express');
const {
  listCompletedRepositories,
  createRepository,
  getRepository,
  getRepositoryFiles,
  updateRepositoryStatus,
  deleteRepositoryChunks,
} = require('../controllers/repository.controller');

const router = Router();

// GET /api/repositories — list all completed repositories
router.get('/', listCompletedRepositories);

// POST /api/repositories
router.post('/', createRepository);

// GET /api/repositories/:id
router.get('/:id', getRepository);

// GET /api/repositories/:id/files
router.get('/:id/files', getRepositoryFiles);

// PATCH /api/repositories/:id/status
router.patch('/:id/status', updateRepositoryStatus);

// DELETE /api/repositories/:id/chunks
router.delete('/:id/chunks', deleteRepositoryChunks);

module.exports = router;
