/**
 * Conversation model — CRUD operations for the `conversations` table.
 *
 * A conversation is a Q&A thread between a user and the AI about a
 * specific repository.
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ userId, repositoryId, title = 'New Conversation' }) => {
  const sql = `
    INSERT INTO conversations (user_id, repository_id, title)
    VALUES (?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [userId, repositoryId, title]);
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM conversations WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const sql = 'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC';
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
};

const findByRepositoryId = async (repositoryId) => {
  const sql = 'SELECT * FROM conversations WHERE repository_id = ? ORDER BY updated_at DESC';
  const [rows] = await pool.execute(sql, [repositoryId]);
  return rows;
};

const findMostRecentByUserIdAndRepositoryId = async (userId, repositoryId) => {
  const sql = `
    SELECT * FROM conversations
    WHERE user_id = ? AND repository_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [userId, repositoryId]);
  return rows[0] || null;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

const update = async (id, fields) => {
  const allowed = ['title'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  const sql = `UPDATE conversations SET ${setClause} WHERE id = ?`;
  await pool.execute(sql, [...values, id]);
  return findById(id);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM conversations WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByUserId, findByRepositoryId, findMostRecentByUserIdAndRepositoryId, update, remove };
