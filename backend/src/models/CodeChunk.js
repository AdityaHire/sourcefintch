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
const { sqlParams } = require('../utils/sqlParams');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({
  fileId,
  file_id,
  qdrantPointId = null,
  qdrant_point_id = null,
  startLine,
  start_line,
  endLine,
  end_line,
  language = null,
}) => {
  const fId = fileId ?? file_id ?? null;
  const qPointId = qdrantPointId ?? qdrant_point_id ?? null;
  const sLine = startLine ?? start_line ?? null;
  const eLine = endLine ?? end_line ?? null;

  const sql = `
    INSERT INTO code_chunks (file_id, qdrant_point_id, start_line, end_line, language)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(
    sql,
    sqlParams([fId, qPointId, sLine, eLine, language])
  );
  return findById(result.insertId);
};

/**
 * Bulk-insert chunks — used when storing all chunks for a parsed repository.
 *
 * Guarantees that returned items match the exact order of `chunksArray`
 * with their generated database `id` and `qdrant_point_id`.
 *
 * Every parameter is coerced to null when undefined so mysql2 accepts it
 * (fields from Qdrant payloads may omit `language` or `qdrant_point_id`).
 */
const createMany = async (chunksArray) => {
  if (!chunksArray || chunksArray.length === 0) return [];

  const normalized = chunksArray.map((c) => ({
    fileId: c.fileId ?? c.file_id ?? null,
    qdrantPointId: c.qdrantPointId ?? c.qdrant_point_id ?? null,
    startLine: c.startLine ?? c.start_line ?? null,
    endLine: c.endLine ?? c.end_line ?? null,
    language: c.language ?? null,
  }));

  const placeholders = normalized.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = normalized.flatMap((c) => [
    c.fileId,
    c.qdrantPointId,
    c.startLine,
    c.endLine,
    c.language,
  ]);

  const sql = `INSERT INTO code_chunks (file_id, qdrant_point_id, start_line, end_line, language) VALUES ${placeholders}`;
  const [result] = await pool.execute(sql, sqlParams(values));

  const firstId = result.insertId;
  return normalized.map((item, index) => ({
    id: firstId + index,
    file_id: item.fileId,
    qdrant_point_id: item.qdrantPointId,
    start_line: item.startLine,
    end_line: item.endLine,
    language: item.language,
  }));
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM code_chunks WHERE id = ?';
  const [rows] = await pool.execute(sql, sqlParams([id]));
  return rows[0] || null;
};

const findByFileId = async (fileId) => {
  const sql = 'SELECT * FROM code_chunks WHERE file_id = ? ORDER BY start_line';
  const [rows] = await pool.execute(sql, sqlParams([fileId]));
  return rows;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const deleteByRepositoryId = async (repositoryId) => {
  const sql = `
    DELETE cc FROM code_chunks cc
    INNER JOIN files f ON cc.file_id = f.id
    WHERE f.repository_id = ?
  `;
  const [result] = await pool.execute(sql, sqlParams([repositoryId]));
  return result.affectedRows;
};

const remove = async (id) => {
  const sql = 'DELETE FROM code_chunks WHERE id = ?';
  const [result] = await pool.execute(sql, sqlParams([id]));
  return result.affectedRows > 0;
};

module.exports = { create, createMany, findById, findByFileId, deleteByRepositoryId, remove };
