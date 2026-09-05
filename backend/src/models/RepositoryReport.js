/**
 * RepositoryReport model — CRUD operations for the `repository_reports` table.
 *
 * Persists generated intelligence reports so they survive server restarts.
 */

const { pool } = require('../config/database');
const { sqlParams } = require('../utils/sqlParams');

const create = async (repositoryId, content) => {
  const sql = `
    INSERT INTO repository_reports (repository_id, content, generated_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE content = VALUES(content), generated_at = NOW()
  `;
  const [result] = await pool.execute(sql, sqlParams([repositoryId, JSON.stringify(content)]));
  return result.insertId || result.affectedRows;
};

const findByRepositoryId = async (repositoryId) => {
  const sql = `
    SELECT id, repository_id, content, generated_at
    FROM repository_reports
    WHERE repository_id = ?
    ORDER BY generated_at DESC
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, sqlParams([repositoryId]));
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
  };
};

const findByRepositoryIdRaw = async (repositoryId) => {
  const sql = `
    SELECT id, repository_id, content, generated_at
    FROM repository_reports
    WHERE repository_id = ?
    ORDER BY generated_at DESC
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, sqlParams([repositoryId]));
  return rows && rows.length > 0 ? rows[0] : null;
};

const deleteByRepositoryId = async (repositoryId) => {
  const sql = `DELETE FROM repository_reports WHERE repository_id = ?`;
  const [result] = await pool.execute(sql, sqlParams([repositoryId]));
  return result.affectedRows;
};

module.exports = {
  create,
  findByRepositoryId,
  findByRepositoryIdRaw,
  deleteByRepositoryId,
};
