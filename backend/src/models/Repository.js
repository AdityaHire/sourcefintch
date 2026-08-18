/**
 * Repository model — CRUD operations for the `repositories` table.
 *
 * A "repository" represents a GitHub repo connected by a user for
 * code analysis.  The `status` field tracks the ingestion pipeline:
 *   pending → cloning → parsing → ready (or error)
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ userId, name, owner, githubUrl, branch = 'main' }) => {
  const sql = `
    INSERT INTO repositories (user_id, name, owner, github_url, branch)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [userId, name, owner, githubUrl, branch]);
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM repositories WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const sql = 'SELECT * FROM repositories WHERE user_id = ? ORDER BY created_at DESC';
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
};

const findActiveByUserId = async (userId) => {
  const sql = `
    SELECT * FROM repositories
    WHERE user_id = ? AND status IN ('pending', 'cloning', 'scanning', 'storing', 'embedding')
    ORDER BY created_at DESC
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

const update = async (id, fields) => {
  const allowed = ['name', 'owner', 'github_url', 'branch', 'status', 'file_count'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  const sql = `UPDATE repositories SET ${setClause} WHERE id = ?`;
  await pool.execute(sql, [...values, id]);
  return findById(id);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM repositories WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByUserId, findActiveByUserId, update, remove };
