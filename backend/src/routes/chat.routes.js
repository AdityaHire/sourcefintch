/**
 * Chat routes — maps the /api/chat endpoint.
 */

const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const { handleChat } = require('../controllers/chat.controller');

const router = Router();

router.post('/', requireAuth, handleChat);

module.exports = router;
