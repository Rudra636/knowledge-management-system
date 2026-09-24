-- Knowledge Management System - MySQL Schema

CREATE DATABASE IF NOT EXISTS knowledge_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE knowledge_management;

-- Stores every uploaded file and its extracted content
CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_type VARCHAR(100),
  mime_type VARCHAR(150),
  file_size BIGINT,
  category VARCHAR(150) DEFAULT 'Uncategorized',
  tags VARCHAR(500),
  extracted_text LONGTEXT,
  summary TEXT,
  key_points JSON,
  extraction_status ENUM('pending', 'processing', 'done', 'unsupported', 'failed') DEFAULT 'pending',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT KEY ft_search (original_name, extracted_text, summary)
) ENGINE=InnoDB;

-- Stores chatbot conversation history, optionally scoped to one file
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Simple folders/categories for organizing files
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
