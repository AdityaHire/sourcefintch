/**
 * File model — CRUD operations for the `files` table.
 *
 * Represents individual source files within a cloned repository.
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ repositoryId, filePath, language = null, fileSize = 0 }) => {
  const sql = `
    INSERT INTO files (repository_id, file_path, language, file_size)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [repositoryId, filePath, language, fileSize]);
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
  if (filesArray.length === 0) return [];

  const placeholders = filesArray.map(() => '(?, ?, ?, ?)').join(', ');
  const values = filesArray.flatMap((f) => [
    f.repositoryId,
    f.filePath,
    f.language || null,
    f.fileSize || 0,
  ]);

  const sql = `INSERT INTO files (repository_id, file_path, language, file_size) VALUES ${placeholders}`;
  await pool.execute(sql, values);

  // Return all files for the repo (simpler than fetching by range of insertIds)
  return findByRepositoryId(filesArray[0].repositoryId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM files WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

const findByRepositoryId = async (repositoryId) => {
  const sql = 'SELECT * FROM files WHERE repository_id = ? ORDER BY file_path';
  const [rows] = await pool.execute(sql, [repositoryId]);
  return rows;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM files WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, createMany, findById, findByRepositoryId, remove };
