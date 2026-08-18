/**
 * Conversation controller — manages chat threads and message retrieval.
 *
 * POST /api/conversations      — create a new conversation thread
 * GET  /api/conversations/:id  — fetch conversation metadata and full message history
 * GET  /api/conversations      — list conversations (optionally filtered by repository_id)
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Repository = require('../models/Repository');

const PLACEHOLDER_USER_ID = 1;

/**
 * Explicit conversation creation (e.g. user clicks "New Chat" in UI).
 */
const createConversation = async (req, res, next) => {
  try {
    const { repository_id, title } = req.body;

    if (!repository_id || isNaN(Number(repository_id))) {
      const err = new Error('repository_id is required');
      err.statusCode = 400;
      throw err;
    }

    const repo = await Repository.findById(repository_id);
    if (!repo) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.create({
      userId: PLACEHOLDER_USER_ID,
      repositoryId: Number(repository_id),
      title: title && typeof title === 'string' && title.trim() ? title.trim() : 'New Conversation',
    });

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a conversation by ID along with its chronological message history.
 */
const getConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
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

/**
 * List conversations for the current user, optionally filtered by repository_id.
 */
const listConversations = async (req, res, next) => {
  try {
    const { repository_id } = req.query;
    let conversations;

    if (repository_id) {
      conversations = await Conversation.findByRepositoryId(repository_id);
    } else {
      conversations = await Conversation.findByUserId(PLACEHOLDER_USER_ID);
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
