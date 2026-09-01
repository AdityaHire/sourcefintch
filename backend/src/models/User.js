/**
 * User model — CRUD operations for the `users` table.
 *
 * Identity is owned by Clerk — we only mirror Clerk's userId, email, name
 * into our database so we can attach owned rows (repositories, conversations,
 * messages) to a Clerk principal.  There is no password_hash here; Clerk
 * handles authentication entirely.
 *
 * PATTERN:
 *   const [rows] = await pool.execute(sql, params);
 *   - For SELECT: `rows` is an array of matching objects.
 *   - For INSERT: `rows` is a ResultSetHeader with `insertId`, `affectedRows`, etc.
 *
 * NOTE on bind parameters:
 *   mysql2 rejects `undefined` as a bind value.  When inserting from optional
 *   Clerk claims (email / name may be null on first sign-in), always coerce
 *   to `null`, never `undefined`.
 */

const { pool } = require('../config/database');
const { sqlParams } = require('../utils/sqlParams');

// ── CREATE ──────────────────────────────────────────────────────────────────

/**
 * Insert a new user.  `id` is the Clerk userId (e.g. "user_2abc...").
 * Missing email/name are stored as null.
 */
const create = async ({ id, email = null, name = null }) => {
  const sql = `
    INSERT INTO users (id, email, name)
    VALUES (?, ?, ?)
  `;
  await pool.execute(sql, sqlParams([id, email, name]));
  return findById(id);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT id, email, name, created_at FROM users WHERE id = ?';
  const [rows] = await pool.execute(sql, sqlParams([id]));
  return rows[0] || null;
};

const findAll = async () => {
  const sql = 'SELECT id, email, name, created_at FROM users';
  const [rows] = await pool.execute(sql);
  return rows;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

const update = async (id, fields) => {
  const allowed = ['email', 'name'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  const sql = `UPDATE users SET ${setClause} WHERE id = ?`;
  await pool.execute(sql, sqlParams([...values, id]));
  return findById(id);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM users WHERE id = ?';
  const [result] = await pool.execute(sql, sqlParams([id]));
  return result.affectedRows > 0;
};

// ── ENSURE (Clerk lazy create) ───────────────────────────────────────────────

/**
 * Get-or-create the local user row for a Clerk principal.
 * Used by the `ensureUser` middleware so the first authenticated request
 * from a new Clerk user transparently creates their mirror row.
 *
 * Accepts either an explicit `email` / `name` (from sessionClaims) or null.
 * Never passes `undefined` to mysql2.
 */
const ensureFromClerk = async ({ id, email = null, name = null }) => {
  const existing = await findById(id);
  if (existing) return existing;
  return create({ id, email, name });
};

module.exports = { create, findById, findAll, update, remove, ensureFromClerk };