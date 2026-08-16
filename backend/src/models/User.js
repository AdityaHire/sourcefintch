/**
 * User model — CRUD operations for the `users` table.
 *
 * Every function uses parameterized queries (the ? placeholders) to prevent
 * SQL injection.  mysql2 escapes the values for us automatically.
 *
 * PATTERN:
 *   const [rows] = await pool.execute(sql, params);
 *   - For SELECT: `rows` is an array of matching objects.
 *   - For INSERT: `rows` is a ResultSetHeader with `insertId`, `affectedRows`, etc.
 *   - For UPDATE/DELETE: `rows` has `affectedRows` and `changedRows`.
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

/**
 * Insert a new user.  Expects a pre-hashed password (never plain text!).
 * Returns the full user object (minus password_hash for safety).
 */
const create = async ({ name, email, passwordHash }) => {
  const sql = `
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [name, email, passwordHash]);
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

/**
 * Find by email — needed for login (check email → compare password hash).
 * This one DOES return password_hash so the auth layer can verify it.
 */
const findByEmail = async (email) => {
  const sql = 'SELECT * FROM users WHERE email = ?';
  const [rows] = await pool.execute(sql, [email]);
  return rows[0] || null;
};

const findAll = async () => {
  const sql = 'SELECT id, name, email, created_at, updated_at FROM users';
  const [rows] = await pool.execute(sql);
  return rows;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

/**
 * Update specific fields on a user.  Only the keys present in `fields`
 * get updated — e.g. update(1, { name: 'New Name' }) won't touch email.
 */
const update = async (id, fields) => {
  const allowed = ['name', 'email', 'password_hash'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  const sql = `UPDATE users SET ${setClause} WHERE id = ?`;
  await pool.execute(sql, [...values, id]);
  return findById(id);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM users WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByEmail, findAll, update, remove };
