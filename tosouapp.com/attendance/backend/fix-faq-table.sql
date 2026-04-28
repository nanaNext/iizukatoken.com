-- Fix FAQ table schema
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS faq_user_questions;

CREATE TABLE faq_user_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  question VARCHAR(500) NOT NULL,
  detail LONGTEXT NULL,
  category VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '未回答',
  admin_answer LONGTEXT NULL,
  admin_answer_by BIGINT UNSIGNED NULL,
  answered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_created (created_at),
  CONSTRAINT fk_faq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;

-- Verify table structure
SELECT 'Table created successfully' as status;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'attendance_db' AND TABLE_NAME = 'faq_user_questions' ORDER BY ORDINAL_POSITION;
