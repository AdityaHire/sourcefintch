/**
 * Repository routes — maps HTTP verbs + paths to controller functions.
 */

const { Router } = require('express');
const { createRepository, getRepository } = require('../controllers/repository.controller');

const router = Router();

// POST /api/repositories
router.post('/', createRepository);

// GET /api/repositories/:id
router.get('/:id', getRepository);

module.exports = router;
