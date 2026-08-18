/**
 * Chat routes — maps the /api/chat endpoint.
 */

const { Router } = require('express');
const { handleChat } = require('../controllers/chat.controller');

const router = Router();

// POST /api/chat
router.post('/', handleChat);

module.exports = router;
