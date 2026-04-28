-- Fix FAQ database schema - Direct SQL
-- Run this to permanently fix the "Unknown column 'uname'" error

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Drop old corrupted table if exists
DROP TABLE IF EXISTS `faq_user_questions`;

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

-- Create new correct table
CREATE TABLE `faq_user_questions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `question` VARCHAR(500) NOT NULL,
  `detail` LONGTEXT NULL,
  `category` VARCHAR(128) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT '未回答',
  `admin_answer` LONGTEXT NULL,
  `admin_answer_by` BIGINT UNSIGNED NULL,
  `answered_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_category` (`category`),
  INDEX `idx_created` (`created_at`),
  CONSTRAINT `fk_faq_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify table was created
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'faq_user_questions'
ORDER BY ORDINAL_POSITION;

-- Result: Should show id, user_id, question, detail, category, status, admin_answer, admin_answer_by, answered_at, created_at, updated_at
-- NO 'uname' column, NO 'name' column
