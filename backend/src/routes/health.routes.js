/**
 * Health routes — maps HTTP verbs + paths to controller functions.
 *
 * Routes are intentionally thin: just `router.get(path, handler)`.
 * All logic lives in the controller so you can test it independently.
 */

const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = Router();

// GET /api/health
router.get('/', getHealth);

module.exports = router;
