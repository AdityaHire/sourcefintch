/**
 * Central route index — mounts every route group.
 *
 * As you add features (GitHub, repos, queries, etc.) you'll import their
 * router here and mount it on a path.  This keeps app.js clean and gives
 * you one file that shows the entire API surface at a glance.
 */

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const repositoriesRoutes = require('./repository.routes');
const chunkRoutes = require('./chunk.routes');
const conversationRoutes = require('./conversation.routes');
const chatRoutes = require('./chat.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/repositories', repositoriesRoutes);
router.use('/chunks', chunkRoutes);
router.use('/conversations', conversationRoutes);
router.use('/chat', chatRoutes);

module.exports = router;
