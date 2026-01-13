-- Create the database
CREATE DATABASE IF NOT EXISTS camara_municipal 
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE camara_municipal;

-- Create users table with can_vote column
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    partido VARCHAR(20) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nivel ENUM('vereador', 'administrador') NOT NULL,
    foto VARCHAR(255) DEFAULT 'img/avatar.jpg',
    can_vote BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for faster password lookups
CREATE INDEX idx_senha ON users(senha);

-- Create voting sessions table
CREATE TABLE voting_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_datetime DATETIME NOT NULL COMMENT 'Data/hora que identifica a sessão',
    title VARCHAR(255) NOT NULL COMMENT 'Título da matéria em votação',
    description TEXT COMMENT 'Descrição opcional da matéria',
    is_active BOOLEAN DEFAULT FALSE COMMENT 'Indica se a votação está aberta',
    favorable_votes INT DEFAULT 0 COMMENT 'Votos favoráveis',
    contrary_votes INT DEFAULT 0 COMMENT 'Votos contrários',
    abstention_votes INT DEFAULT 0 COMMENT 'Abstenções',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE voting_sessions ADD COLUMN redirect_status VARCHAR(20) DEFAULT NULL;

ALTER TABLE voting_sessions ADD COLUMN is_finalized BOOLEAN DEFAULT FALSE COMMENT 'Indica se a votação foi finalizada';

-- Create index for session status
CREATE INDEX idx_session_active ON voting_sessions(is_active);
CREATE INDEX idx_session_finalized ON voting_sessions(is_finalized);

-- Create votes table to track individual votes
CREATE TABLE votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    user_id INT NOT NULL,
    vote_type ENUM('favorable', 'contrary', 'abstention') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES voting_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_vote (session_id, user_id)
);

CREATE TABLE tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- Permitir valores NULL
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
);

-- (Administrador) 
INSERT INTO users (nome, partido, senha, nivel, foto) VALUES
(
    'Administrador',
    'Sem Partido',
    'MDhkNzIwM2ZlZWM2Y2ViMDZlZDk4MWUyOWIwN2M1ZTg5NmFmNGU2OTQ0NzVk', -- senha: 375120
    'administrador',
    'img/avatar.jpg'
);


