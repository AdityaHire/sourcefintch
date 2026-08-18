/**
 * Message model — CRUD operations for the `messages` table.
 *
 * Messages belong to a conversation.  Each message has a `role`:
 *   - 'user'      — the developer asking a question
 *   - 'assistant' — the AI's response (with citations stored in `sources`)
 */

const { pool } = require('../config/database');

const parseMessage = (row) => {
  if (!row) return null;
  const msg = { ...row };
  if (typeof msg.sources === 'string') {
    try {
      msg.sources = JSON.parse(msg.sources);
    } catch {
      // Fallback: leave as-is if string isn't valid JSON
    }
  }
  return msg;
};

// ── CREATE ──────────────────────────────────────────────────────────────────

const create = async ({ conversationId, role, content, sources = null }) => {
  const serializedSources =
    sources !== null && sources !== undefined
      ? typeof sources === 'string'
        ? sources
        : JSON.stringify(sources)
      : null;

  const sql = `
    INSERT INTO messages (conversation_id, role, content, sources)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [
    conversationId,
    role,
    content,
    serializedSources,
  ]);
  return findById(result.insertId);
};

// ── READ ────────────────────────────────────────────────────────────────────

const findById = async (id) => {
  const sql = 'SELECT * FROM messages WHERE id = ?';
  const [rows] = await pool.execute(sql, [id]);
  return parseMessage(rows[0]) || null;
};

/**
 * Get all messages in a conversation, oldest first.
 * This is the natural chronological order for rendering a chat thread.
 */
const findByConversationId = async (conversationId) => {
  const sql = `
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, id ASC
  `;
  const [rows] = await pool.execute(sql, [conversationId]);
  return rows.map(parseMessage);
};

// ── DELETE ──────────────────────────────────────────────────────────────────

const remove = async (id) => {
  const sql = 'DELETE FROM messages WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

module.exports = { create, findById, findByConversationId, remove };
