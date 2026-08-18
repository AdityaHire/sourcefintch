-- ============================================================================
-- Sourcefinch — Initial Schema (Phase 2)
--
-- Creates all 6 tables in dependency order so foreign keys resolve correctly.
-- Run with:  npm run migrate  (from the backend/ directory)
-- ============================================================================

-- ── 1. users ────────────────────────────────────────────────────────────────
-- Stores registered developer accounts.
-- password_hash: we NEVER store plain-text passwords — only bcrypt hashes.
-- This table may already exist in a shared database — IF NOT EXISTS skips it.
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255)  NOT NULL,
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 2. repositories ────────────────────────────────────────────────────────
-- A GitHub repo connected by a user for analysis.
-- status tracks the ingestion pipeline: pending → cloning → scanning → storing → completed / failed
-- ON DELETE CASCADE: if a user is deleted, all their repos go too.
CREATE TABLE IF NOT EXISTS repositories (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT           NOT NULL,
  name           VARCHAR(255)  NOT NULL,
  owner          VARCHAR(255)  NOT NULL,
  github_url     VARCHAR(2048) NOT NULL,
  branch         VARCHAR(255)  NOT NULL DEFAULT 'main',
  status         ENUM('pending','cloning','scanning','storing','completed','failed') NOT NULL DEFAULT 'pending',
  file_count     INT           NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 3. files ────────────────────────────────────────────────────────────────
-- Individual source files within a repository.
-- ON DELETE CASCADE: deleting a repo removes all its files.
CREATE TABLE IF NOT EXISTS files (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  repository_id   INT           NOT NULL,
  file_path       VARCHAR(1024) NOT NULL,
  language        VARCHAR(50)   DEFAULT NULL,
  file_size       INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 4. code_chunks ──────────────────────────────────────────────────────────
-- Metadata / pointers for chunks of code sent to the vector database.
--
-- IMPORTANT: There is NO `content` column here on purpose.
-- The actual chunk text lives ONLY in Qdrant (the vector database, wired up
-- in a later phase).  Storing it in both places would mean:
--   • doubled storage costs
--   • a sync nightmare (which copy is "truth"?)
-- Instead, this table stores the line-range metadata and a qdrant_point_id
-- that lets us look up the full text + embedding in Qdrant when needed.
--
-- ON DELETE CASCADE: deleting a file removes all its chunks.
CREATE TABLE IF NOT EXISTS code_chunks (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  file_id          INT           NOT NULL,
  qdrant_point_id  VARCHAR(36)   DEFAULT NULL,
  start_line       INT           NOT NULL,
  end_line         INT           NOT NULL,
  language         VARCHAR(50)   DEFAULT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 5. conversations ────────────────────────────────────────────────────────
-- A Q&A conversation between a user and the AI about a specific repo.
-- ON DELETE CASCADE (user_id): if a user is deleted, their conversations go too.
-- ON DELETE SET NULL (repository_id): if a repo is deleted, keep the conversation
--   history (it's still useful) but clear the repo reference.
CREATE TABLE IF NOT EXISTS conversations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  repository_id   INT           DEFAULT NULL,
  title           VARCHAR(500)  NOT NULL DEFAULT 'New Conversation',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 6. messages ─────────────────────────────────────────────────────────────
-- Individual messages within a conversation.
-- role: 'user' (the developer asking) or 'assistant' (the AI answering).
-- ON DELETE CASCADE: deleting a conversation removes all its messages.
CREATE TABLE IF NOT EXISTS messages (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id   INT           NOT NULL,
  role              ENUM('user','assistant') NOT NULL,
  content           TEXT          NOT NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

