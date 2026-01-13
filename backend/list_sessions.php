<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $db = getDbConnection();
    $stmt = $db->query('SELECT * FROM voting_sessions ORDER BY session_datetime DESC');
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($sessions);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

