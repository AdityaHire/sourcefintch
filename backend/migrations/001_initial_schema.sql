-- ============================================================================
-- Sourcefinch — Single Consolidated Schema (Clerk-native)
--
-- This migration replaces the prior multi-file schema (001_initial_schema,
-- 003_add_embedding_status, 004_add_sources_to_messages, 005_clerk_user_ids).
-- The previous files have been deleted and this single migration recreates
-- the full final schema in one pass.
--
-- DESTRUCTIVE RESET
-- =================
-- This is a full destructive reset of the schema.  No data is preserved.
-- Tables are dropped in reverse-FK order, then recreated in dependency order.
--
-- Manual reset reference (run from a MySQL shell if `npm run migrate` is
-- unavailable, e.g. before the backend has booted against a fresh DB):
--
--   DROP DATABASE IF EXISTS sourcefinch;
--   CREATE DATABASE sourcefinch
--     CHARACTER SET utf8mb4
--     COLLATE utf8mb4_unicode_ci;
--
-- Then run:  cd backend && npm run migrate
--
-- IDENTITY MODEL
-- ==============
-- Identity is owned entirely by Clerk.  The `users` table is a thin mirror
-- keyed on Clerk's string userId ("user_2abc...").  No password_hash,
-- google_id, github_id, or auth_provider columns exist — Clerk owns all of
-- that.  All FK columns (repositories.user_id, conversations.user_id) are
-- VARCHAR(255) to match.
--
-- FILE CONTENT STORAGE
-- ====================
-- `files.content` (LONGTEXT) holds the raw source bytes for each indexed
-- file.  The semantic AST chunks themselves live in `code_chunks` (with
-- their full text in Qdrant); `files.content` is the un-chunked source we
-- use for line-permalink lookups from chat citations.
--
-- SOURCES COLUMN ON MESSAGES
-- ==========================
-- `messages.sources` (JSON, nullable) stores the retrieval citations that
-- accompanied an assistant reply, used to replay conversations with the
-- same source badges.
-- ============================================================================

-- ── 1. users ────────────────────────────────────────────────────────────────
-- Identity mirror for Clerk.  One row per Clerk userId, lazy-created on
-- the first authenticated request.
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(255) NOT NULL,
  email         VARCHAR(255) DEFAULT NULL,
  name          VARCHAR(255) DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 2. repositories ────────────────────────────────────────────────────────
-- GitHub repos connected by a user for analysis.
-- status tracks the ingestion pipeline: pending → cloning → scanning →
--   storing → embedding → completed / failed.
CREATE TABLE IF NOT EXISTS repositories (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        VARCHAR(255)  NOT NULL,
  name           VARCHAR(255)  NOT NULL,
  owner          VARCHAR(255)  NOT NULL,
  github_url     VARCHAR(2048) NOT NULL,
  branch         VARCHAR(255)  NOT NULL DEFAULT 'main',
  status         ENUM('pending','cloning','scanning','storing','embedding','completed','failed')
                 NOT NULL DEFAULT 'pending',
  file_count     INT           NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  KEY repositories_user_id_idx (user_id),
  CONSTRAINT repositories_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 3. files ───────────────────────────────────────────────────────────────
-- Individual source files within a repository.  `content` is the raw
-- source — needed for line-permalink citations.
CREATE TABLE IF NOT EXISTS files (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  repository_id   INT           NOT NULL,
  file_path       VARCHAR(1024) NOT NULL,
  language        VARCHAR(50)   DEFAULT NULL,
  file_size       INT           NOT NULL DEFAULT 0,
  content         LONGTEXT      DEFAULT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY files_repository_id_idx (repository_id),
  CONSTRAINT files_repository_id_fk
    FOREIGN KEY (repository_id) REFERENCES repositories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 4. code_chunks ──────────────────────────────────────────────────────────
-- Metadata/pointers for chunks of code sent to the vector database.
-- The actual chunk TEXT lives ONLY in Qdrant, referenced via
-- qdrant_point_id.  This table is intentionally content-less to avoid
-- duplication and sync drift.
CREATE TABLE IF NOT EXISTS code_chunks (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  file_id          INT          NOT NULL,
  qdrant_point_id  VARCHAR(36)  DEFAULT NULL,
  start_line       INT          NOT NULL,
  end_line         INT          NOT NULL,
  language         VARCHAR(50)  DEFAULT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY code_chunks_file_id_idx (file_id),
  CONSTRAINT code_chunks_file_id_fk
    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 5. conversations ────────────────────────────────────────────────────────
-- Q&A conversation threads between a user and the AI about a repository.
-- ON DELETE CASCADE on user_id, ON DELETE SET NULL on repository_id so we
-- keep the conversation history even if the repo is later removed.
CREATE TABLE IF NOT EXISTS conversations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL,
  repository_id   INT          DEFAULT NULL,
  title           VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  KEY conversations_user_id_idx (user_id),
  KEY conversations_repository_id_idx (repository_id),
  CONSTRAINT conversations_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT conversations_repository_id_fk
    FOREIGN KEY (repository_id) REFERENCES repositories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 6. messages ─────────────────────────────────────────────────────────────
-- role: 'user' (the developer) or 'assistant' (the AI).
-- sources: JSON array of citation objects (nullable).
CREATE TABLE IF NOT EXISTS messages (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id   INT           NOT NULL,
  role              ENUM('user','assistant') NOT NULL,
  content           TEXT          NOT NULL,
  sources           JSON          DEFAULT NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY messages_conversation_id_idx (conversation_id),
  CONSTRAINT messages_conversation_id_fk
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;