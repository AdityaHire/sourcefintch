-- ============================================================================
-- Sourcefinch — Migration 003: Add 'embedding' status to repositories table
--
-- Extends repositories.status ENUM to track vector generation and Qdrant storage:
--   pending → cloning → scanning → storing → embedding → completed / failed
-- ============================================================================

ALTER TABLE repositories
MODIFY COLUMN status ENUM('pending','cloning','scanning','storing','embedding','completed','failed')
NOT NULL DEFAULT 'pending';
