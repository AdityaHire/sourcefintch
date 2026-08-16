/**
 * Message model — CRUD operations for the `messages` table.
 *
 * Messages belong to a conversation.  Each message has a `role`:
 *   - 'user'      — the developer asking a question
 *   - 'assistant' — the AI's response (with citations)
 */

const { pool } = require('../config/database');

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ conversationId, role, content }) => {
  const sql = `
    INSERT INTO messages (conversation_id, role, content)
    VALUES (?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [conversationId, role, content]);
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM messages WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
};

/**
 * Get all messages in a conversation, oldest first.
 * This is the natural order for rendering a chat thread.
 */
const findByConversationId = async (conversationId) => {
  const sql = 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC';
  const [rows] = await pool.execute(sql, [conversationId]);
  return rows;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM messages WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByConversationId, remove };
