/**
 * Conversation routes — frontend-only.
 *
 * /api/conversations/:id is called by BOTH the frontend AND the AI service
 * (the AI fetches conversation history). It uses requireAuthOrInternal.
 *
 * The list/create endpoints stay requireAuth.
 */

const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAuthOrInternal = require('../middleware/requireAuthOrInternal');
const {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  deleteAllConversations,
} = require('../controllers/conversation.controller');

const router = Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, createConversation);
router.delete('/', requireAuth, deleteAllConversations);

// AI service fetches history with x-internal-secret; users fetch with session token.
router.get('/:id', requireAuthOrInternal, getConversation);
router.patch('/:id', requireAuth, updateConversation);
router.delete('/:id', requireAuth, deleteConversation);

module.exports = router;