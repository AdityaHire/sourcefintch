/**
 * Chunk routes — maps HTTP verbs + paths for code chunks.
 */

const { Router } = require('express');
const requireInternalSecret = require('../middleware/requireInternalSecret');
const { createBatchChunks, createChunk } = require('../controllers/chunk.controller');

const router = Router();

// AI service only — these write metadata in bulk during ingestion.
router.post('/batch', requireInternalSecret, createBatchChunks);
router.post('/', requireInternalSecret, createChunk);

module.exports = router;
