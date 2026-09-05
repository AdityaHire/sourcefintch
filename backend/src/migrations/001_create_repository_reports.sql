-- repository_reports table migration
-- Run this against your MySQL database to add persistent report storage.

CREATE TABLE IF NOT EXISTS repository_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repository_id INT NOT NULL,
    content JSON NOT NULL,
    generated_at DATETIME NOT NULL,
    INDEX idx_repository_reports_repo_id (repository_id),
    INDEX idx_repository_reports_generated_at (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
