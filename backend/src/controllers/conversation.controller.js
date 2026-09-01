/**
 * Conversation controller — manages chat threads and message retrieval.
 *
 * Auth source: req.auth.userId (Clerk) set by requireAuth middleware.
 * The GET /:id endpoint is dual-mode and skips ownership enforcement for
 * internal AI-service calls (req.auth?.userId absent).
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Repository = require('../models/Repository');
const { getAuth } = require('@clerk/express');

const userId = (req) => getAuth(req)?.userId ?? null;

const createConversation = async (req, res, next) => {
  try {
    const { repository_id, title } = req.body;
    const currentUserId = userId(req);

    if (!repository_id || isNaN(Number(repository_id))) {
      const err = new Error('repository_id is required');
      err.statusCode = 400;
      throw err;
    }

    const repo = await Repository.findById(repository_id);
    if (!repo || repo.user_id !== currentUserId) {
      // Return 404 on missing OR not-owned to avoid leaking existence
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.create({
      userId: currentUserId,
      repositoryId: Number(repository_id),
      title:
        title && typeof title === 'string' && title.trim()
          ? title.trim()
          : 'New Conversation',
    });

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check for authenticated callers only.
    const currentUserId = userId(req);
    if (currentUserId && conversation.user_id !== currentUserId) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const messages = await Message.findByConversationId(id);

    res.json({
      ...conversation,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

const listConversations = async (req, res, next) => {
  try {
    const { repository_id } = req.query;
    const currentUserId = userId(req);
    let conversations;

    if (repository_id) {
      const allForRepo = await Conversation.findByRepositoryId(repository_id);
      conversations = allForRepo.filter((c) => c.user_id === currentUserId);
    } else {
      conversations = await Conversation.findByUserId(currentUserId);
    }

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createConversation,
  getConversation,
  listConversations,
};