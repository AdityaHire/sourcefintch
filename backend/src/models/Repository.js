/**
 * Repository model — CRUD operations for the `repositories` table.
 *
 * A "repository" represents a GitHub repo connected by a user for
 * code analysis.  The `status` field tracks the ingestion pipeline:
 *   pending → cloning → parsing → ready (or error)
 */

const { pool } = require('../config/database');
const { sqlParams } = require('../utils/sqlParams');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ userId, name, owner, githubUrl, branch = 'main' }) => {
  const sql = `
    INSERT INTO repositories (user_id, name, owner, github_url, branch)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(
    sql,
    sqlParams([userId, name, owner, githubUrl, branch])
  );
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM repositories WHERE id = ?';
  const [rows] = await pool.execute(sql, sqlParams([id]));
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const sql = 'SELECT * FROM repositories WHERE user_id = ? ORDER BY created_at DESC';
  const [rows] = await pool.execute(sql, sqlParams([userId]));
  return rows;
};

const findCompleted = async () => {
  const sql = `
    SELECT id, user_id, name, owner, github_url, branch, file_count, status, created_at
    FROM repositories
    WHERE status = 'completed'
    ORDER BY created_at DESC
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

const findCompletedByUserId = async (userId) => {
  const sql = `
    SELECT id, user_id, name, owner, github_url, branch, file_count, status, created_at
    FROM repositories
    WHERE user_id = ? AND status = 'completed'
    ORDER BY created_at DESC
  `;
  const [rows] = await pool.execute(sql, sqlParams([userId]));
  return rows;
};

const findActiveByUserId = async (userId) => {
  const sql = `
    SELECT * FROM repositories
    WHERE user_id = ? AND status IN ('pending', 'cloning', 'scanning', 'storing', 'embedding')
    ORDER BY created_at DESC
  `;
  const [rows] = await pool.execute(sql, sqlParams([userId]));
  return rows;
};

// Repos that have been "active" longer than this many minutes are considered
// stuck (worker died, AI service crashed, network blip, etc.) and will be
// auto-failed so the user can retry.  Default: 30 minutes.
const STUCK_THRESHOLD_MINUTES = Number(
  process.env.INGESTION_STUCK_MINUTES || 30
);

const expireStuckRepositories = async () => {
  const sql = `
    UPDATE repositories
    SET status = 'failed'
    WHERE status IN ('pending', 'cloning', 'scanning', 'storing', 'embedding')
      AND updated_at < (NOW() - INTERVAL ? MINUTE)
  `;
  const [result] = await pool.execute(sql, [STUCK_THRESHOLD_MINUTES]);
  return result.affectedRows;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

const update = async (id, fields) => {
  const allowed = ['name', 'owner', 'github_url', 'branch', 'status', 'file_count'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  const sql = `UPDATE repositories SET ${setClause} WHERE id = ?`;
  await pool.execute(sql, sqlParams([...values, id]));
  return findById(id);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM repositories WHERE id = ?';
  const [result] = await pool.execute(sql, sqlParams([id]));
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByUserId, findCompleted, findCompletedByUserId, findActiveByUserId, expireStuckRepositories, update, remove };
