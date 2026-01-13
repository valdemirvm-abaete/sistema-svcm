<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'camara_municipal');
define('DB_USER', 'root');
define('DB_PASS', '');

function getDbConnection() {
    try {
        $db = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS
        );
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $db;
    } catch (PDOException $e) {
        error_log('Database connection error: ' . $e->getMessage());
        throw new Exception('Database connection failed');
    }
}

