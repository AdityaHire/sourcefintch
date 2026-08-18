/**
 * Conversation routes — maps endpoints for conversation management.
 */

const { Router } = require('express');
const {
  createConversation,
  getConversation,
  listConversations,
} = require('../controllers/conversation.controller');

const router = Router();

// GET /api/conversations
router.get('/', listConversations);

// POST /api/conversations
router.post('/', createConversation);

// GET /api/conversations/:id
router.get('/:id', getConversation);

module.exports = router;
