/**
 * CodeChunk model — CRUD operations for the `code_chunks` table.
 *
 * IMPORTANT DESIGN NOTE:
 * This table stores metadata/pointers ONLY — there is no `content` column.
 * The actual chunk text lives in Qdrant (the vector database) and is
 * referenced via `qdrant_point_id`.  This avoids duplicating potentially
 * large amounts of text between MySQL and Qdrant.
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ fileId, qdrantPointId = null, startLine, endLine, language = null }) => {
  const sql = `
    INSERT INTO code_chunks (file_id, qdrant_point_id, start_line, end_line, language)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [fileId, qdrantPointId, startLine, endLine, language]);
  return findById(result.insertId);
};

/**
 * Bulk-insert chunks — used when parsing an entire file into chunks.
 */
const createMany = async (chunksArray) => {
  if (chunksArray.length === 0) return [];

  const placeholders = chunksArray.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = chunksArray.flatMap((c) => [
    c.fileId,
    c.qdrantPointId || null,
    c.startLine,
    c.endLine,
    c.language || null,
  ]);

  const sql = `INSERT INTO code_chunks (file_id, qdrant_point_id, start_line, end_line, language) VALUES ${placeholders}`;
  await pool.execute(sql, values);

  return findByFileId(chunksArray[0].fileId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM code_chunks WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

const findByFileId = async (fileId) => {
  const sql = 'SELECT * FROM code_chunks WHERE file_id = ? ORDER BY start_line';
  const [rows] = await pool.execute(sql, [fileId]);
  return rows;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM code_chunks WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, createMany, findById, findByFileId, remove };
