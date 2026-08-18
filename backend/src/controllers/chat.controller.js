/**
 * Chat controller — orchestrates RAG chat queries between the Node backend,
 * MySQL message persistence, and the Python AI service.
 *
 * POST /api/chat — submit user message, persist history, query Python /ai/chat
 */

const config = require('../config/environment');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Repository = require('../models/Repository');

const PLACEHOLDER_USER_ID = 1;
const AI_CHAT_TIMEOUT_MS = 45_000; // 45s timeout for embedding + retrieval + LLM generation

const handleChat = async (req, res, next) => {
  try {
    const { conversation_id, repository_id, message } = req.body;

    // ── 1. Input Validation ──────────────────────────────────────────────────
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

    // ── 2. Conversation & Mismatch Validation ───────────────────────────────
    let activeConversationId;

    if (conversation_id) {
      const conv = await Conversation.findById(conversation_id);
      if (!conv) {
        const err = new Error('Conversation not found');
        err.statusCode = 404;
        throw err;
      }

      // Explicit mismatch guard: ensure conversation belongs to requested repository
      if (conv.repository_id !== repoIdNum) {
        const err = new Error(
          `conversation_id ${conversation_id} belongs to repository ${conv.repository_id}, not repository ${repoIdNum}`
        );
        err.statusCode = 400;
        throw err;
      }

      activeConversationId = conv.id;
    } else {
      // Auto-create conversation using the first 50 chars of the message as title
      const title = cleanedMessage.slice(0, 50).trim() || 'New Conversation';
      const newConv = await Conversation.create({
        userId: PLACEHOLDER_USER_ID,
        repositoryId: repoIdNum,
        title,
      });
      activeConversationId = newConv.id;
    }

    // ── 3. Pre-Call User Message Persistence ────────────────────────────────
    // User message is saved before calling Python. If AI fails, the user question remains recorded.
    await Message.create({
      conversationId: activeConversationId,
      role: 'user',
      content: cleanedMessage,
      sources: null,
    });

    // ── 4. Call Python AI Service ───────────────────────────────────────────
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
        }),
        signal: abortController.signal,
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        const err = new Error(`AI service timed out after ${Math.round(AI_CHAT_TIMEOUT_MS / 1000)}s`);
        err.statusCode = 504;
        throw err;
      }
      const err = new Error(`Unable to reach AI service: ${networkErr.message}`);
      err.statusCode = 502;
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // ── 5. Relay Python Status & Errors Unchanged ───────────────────────────
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

    // ── 6. Save Assistant Message with Sources (Resilient) ──────────────────
    let assistantMessageId = null;
    try {
      const savedAssistant = await Message.create({
        conversationId: activeConversationId,
        role: 'assistant',
        content: answer,
        sources,
      });
      assistantMessageId = savedAssistant?.id || null;
    } catch (dbErr) {
      // Log persistence error server-side without failing the client request
      console.error(
        `[chat] Failed to persist assistant message for conversation ${activeConversationId}:`,
        dbErr.message
      );
    }

    // ── 7. Return Successful Response ───────────────────────────────────────
    res.json({
      conversation_id: activeConversationId,
      message: {
        id: assistantMessageId,
        role: 'assistant',
        content: answer,
        sources,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleChat,
};
