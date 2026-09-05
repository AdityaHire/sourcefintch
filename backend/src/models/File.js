/**
 * File model — CRUD operations for the `files` table.
 *
 * Represents individual source files within a cloned repository.  The
 * `content` column (LONGTEXT) holds the raw source text so line-permalink
 * citations can resolve without re-reading from disk.
 */

const { pool } = require('../config/database');
const { sqlParams } = require('../utils/sqlParams');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({
  repositoryId,
  filePath,
  language = null,
  fileSize = 0,
  content = null,
}) => {
  const sql = `
    INSERT INTO files (repository_id, file_path, language, file_size, content)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(
    sql,
    sqlParams([repositoryId, filePath, language, fileSize, content])
  );
  return findById(result.insertId);
};

/**
 * Bulk-insert multiple files at once — much faster than inserting one at a
 * time when we clone a repo with hundreds of files.
 *
 * mysql2's execute() doesn't support multi-row inserts with ?-placeholders
 * natively, so we build the VALUES list manually (still parameterized).
 */
const createMany = async (filesArray) => {
  if (!filesArray || filesArray.length === 0) return [];

  const BATCH_SIZE = 500;
  for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
    const chunk = filesArray.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = chunk.flatMap((f) => [
      f.repositoryId,
      f.filePath,
      f.language ?? null,
      f.fileSize ?? 0,
      f.content ?? null,
    ]);

    const sql = `INSERT INTO files (repository_id, file_path, language, file_size, content) VALUES ${placeholders}`;
    await pool.execute(sql, sqlParams(values));
  }

  return filesArray;
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM files WHERE id = ?';
  const [rows] = await pool.execute(sql, sqlParams([id]));
  return rows[0] || null;
};

const findByRepositoryId = async (repositoryId) => {
  const sql = 'SELECT * FROM files WHERE repository_id = ? ORDER BY file_path';
  const [rows] = await pool.execute(sql, sqlParams([repositoryId]));
  return rows;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM files WHERE id = ?';
  const [result] = await pool.execute(sql, sqlParams([id]));
  return result.affectedRows > 0;
};

module.exports = { create, createMany, findById, findByRepositoryId, remove };