/**
 * Chat controller — orchestrates RAG chat queries between the Node backend,
 * MySQL message persistence, and the Python AI service.
 *
 * Auth source: req.auth.userId (Clerk).
 */

const config = require('../config/environment');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Repository = require('../models/Repository');
const { getAuth } = require('@clerk/express');

const AI_CHAT_TIMEOUT_MS = 45_000;

const userId = (req) => getAuth(req)?.userId ?? null;

const handleChat = async (req, res, next) => {
  try {
    const { conversation_id, repository_id, message, new_conversation } = req.body;
    const currentUserId = userId(req);

    // ── 1. Input Validation ────────────────────────────────────────────────
    if (!repository_id || isNaN(Number(repository_id))) {
      const err = new Error('repository_id is required');
      err.statusCode = 400;
      throw err;
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      const err = new Error('message is required');
      err.statusCode = 400;
      throw err;
    }

    const cleanedMessage = message.trim();
    const repoIdNum = Number(repository_id);
    const repo = await Repository.findById(repoIdNum);
    if (!repo || repo.user_id !== currentUserId) {
      const err = new Error('Repository not found');
      err.statusCode = 404;
      throw err;
    }

    // ── 2. Conversation Resolution ─────────────────────────────────────────
    let activeConversationId;

    if (conversation_id && !isNaN(Number(conversation_id))) {
      const conv = await Conversation.findById(Number(conversation_id));
      if (!conv || conv.user_id !== currentUserId) {
        const err = new Error('Conversation not found');
        err.statusCode = 404;
        throw err;
      }
      if (conv.repository_id !== repoIdNum) {
        const err = new Error(
          `conversation_id ${conversation_id} belongs to repository ${conv.repository_id}, not repository ${repoIdNum}`
        );
        err.statusCode = 400;
        throw err;
      }
      activeConversationId = conv.id;
    } else if (new_conversation) {
      const title = cleanedMessage.slice(0, 50).trim() || 'New Conversation';
      const newConv = await Conversation.create({
        userId: currentUserId,
        repositoryId: repoIdNum,
        title,
      });
      activeConversationId = newConv.id;
    } else {
      const recent = await Conversation.findMostRecentByUserIdAndRepositoryId(
        currentUserId,
        repoIdNum
      );
      if (recent) {
        activeConversationId = recent.id;
      } else {
        const title = cleanedMessage.slice(0, 50).trim() || 'New Conversation';
        const newConv = await Conversation.create({
          userId: currentUserId,
          repositoryId: repoIdNum,
          title,
        });
        activeConversationId = newConv.id;
      }
    }

    // ── 3. Pre-Call User Message Persistence ───────────────────────────────
    await Message.create({
      conversationId: activeConversationId,
      role: 'user',
      content: cleanedMessage,
      sources: null,
    });

    // ── 4. Call Python AI Service ──────────────────────────────────────────
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), AI_CHAT_TIMEOUT_MS);

    let aiResponse;
    try {
      aiResponse = await fetch(`${config.aiServiceUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_id: repoIdNum,
          message: cleanedMessage,
          conversation_id: activeConversationId,
        }),
        signal: abortController.signal,
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        const err = new Error(
          `AI service timed out after ${Math.round(AI_CHAT_TIMEOUT_MS / 1000)}s`
        );
        err.statusCode = 504;
        throw err;
      }
      const err = new Error(`Unable to reach AI service: ${networkErr.message}`);
      err.statusCode = 502;
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // ── 5. Relay Python Status & Errors Unchanged ─────────────────────────
    if (!aiResponse.ok) {
      let errorPayload = null;
      try {
        errorPayload = await aiResponse.json();
      } catch {
        errorPayload = null;
      }

      const errorMessage =
        (errorPayload && (errorPayload.message || errorPayload.detail)) ||
        `AI service failed with status ${aiResponse.status}`;

      const err = new Error(errorMessage);
      err.statusCode = aiResponse.status;
      throw err;
    }

    const aiData = await aiResponse.json();
    const answer = aiData.answer || '';
    const sources = aiData.sources || [];

    // ── 6. Save Assistant Message with Sources (Resilient) ────────────────
    let assistantMessageId = null;
    let persistenceWarning = false;
    try {
      const savedAssistant = await Message.create({
        conversationId: activeConversationId,
        role: 'assistant',
        content: answer,
        sources,
      });
      assistantMessageId = savedAssistant?.id || null;
    } catch (dbErr) {
      persistenceWarning = true;
      console.error(
        {
          conversation_id: activeConversationId,
          message_length: answer.length,
          error: dbErr.message,
          stack: dbErr.stack,
        },
        '[chat] Failed to persist assistant message'
      );
    }

    // ── 7. Return Successful Response ──────────────────────────────────────
    res.json({
      conversation_id: activeConversationId,
      message: {
        id: assistantMessageId,
        role: 'assistant',
        content: answer,
        sources,
      },
      persistence_warning: persistenceWarning || undefined,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleChat,
};