/**
 * Chunk controller — handles code chunk storage endpoints.
 *
 * POST /api/chunks/batch — bulk-insert chunks for a repository
 * POST /api/chunks       — create a single chunk
 */

const CodeChunk = require('../models/CodeChunk');

/**
 * Bulk-insert chunks into MySQL.
 *
 * The AI service calls this to record chunk metadata in MySQL before
 * upserting vectors into Qdrant.
 *
 * GUARANTEE:
 * Returns the created chunk records in the EXACT SAME ORDER as the input
 * `chunks` array, with `id` (MySQL auto_increment) and `qdrant_point_id`
 * for 1-to-1 correlation by Python.
 */
const createBatchChunks = async (req, res, next) => {
  try {
    const { chunks } = req.body;

    if (!Array.isArray(chunks)) {
      const err = new Error('chunks must be an array');
      err.statusCode = 400;
      throw err;
    }

    if (chunks.length === 0) {
      return res.status(201).json({ chunks: [] });
    }

    // Validate each chunk has required fields
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const fileId = c.file_id || c.fileId;
      const startLine = c.start_line !== undefined ? c.start_line : c.startLine;
      const endLine = c.end_line !== undefined ? c.end_line : c.endLine;

      if (!fileId || startLine === undefined || endLine === undefined) {
        const err = new Error(
          `Chunk at index ${i} is missing required fields: file_id, start_line, or end_line`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const insertedChunks = await CodeChunk.createMany(chunks);
    res.status(201).json({ chunks: insertedChunks });
  } catch (error) {
    next(error);
  }
};

/**
 * Single chunk creation utility.
 */
const createChunk = async (req, res, next) => {
  try {
    const { file_id, fileId, qdrant_point_id, qdrantPointId, start_line, startLine, end_line, endLine, language } = req.body;
    const fId = file_id || fileId;
    const qPointId = qdrant_point_id || qdrantPointId;
    const sLine = start_line !== undefined ? start_line : startLine;
    const eLine = end_line !== undefined ? end_line : endLine;

    if (!fId || sLine === undefined || eLine === undefined) {
      const err = new Error('file_id, start_line, and end_line are required');
      err.statusCode = 400;
      throw err;
    }

    const chunk = await CodeChunk.create({
      fileId: fId,
      qdrantPointId: qPointId,
      startLine: sLine,
      endLine: eLine,
      language,
    });

    res.status(201).json(chunk);
  } catch (error) {
    next(error);
  }
};

module.exports = { createBatchChunks, createChunk };
