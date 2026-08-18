-- Migration 004: Add sources JSON column to messages table
-- Allows storing retrieval source citations on assistant messages for conversation replay.

ALTER TABLE messages
  ADD COLUMN sources JSON NULL AFTER content;
