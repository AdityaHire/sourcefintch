/**
 * Chat routes — maps the /api/chat endpoint.
 */

const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const { chatRateLimiter } = require('../middleware/rateLimiter');
const { handleChat, handleChatStream } = require('../controllers/chat.controller');

const router = Router();

router.post('/', requireAuth, chatRateLimiter, handleChat);
router.post('/stream', requireAuth, chatRateLimiter, handleChatStream);

module.exports = router;
