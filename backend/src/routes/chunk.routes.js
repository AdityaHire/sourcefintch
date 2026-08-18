/**
 * Chunk routes — maps HTTP verbs + paths for code chunks.
 */

const { Router } = require('express');
const { createBatchChunks, createChunk } = require('../controllers/chunk.controller');

const router = Router();

// POST /api/chunks/batch — mandated bulk insert endpoint for AI indexing
router.post('/batch', createBatchChunks);

// POST /api/chunks — single chunk creation utility
router.post('/', createChunk);

module.exports = router;
