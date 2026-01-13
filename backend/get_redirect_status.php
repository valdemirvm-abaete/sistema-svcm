<?php
header('Content-Type: application/json');
require_once 'db_config.php';

try {
    $db = getDbConnection();
    
    // First, try to get active session with redirect_status set
    $stmt = $db->query('SELECT id, redirect_status FROM voting_sessions WHERE is_active = TRUE AND redirect_status IS NOT NULL LIMIT 1');
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // If no active session with redirect_status, check for finalized session with redirect_status set
    if (!$result) {
        $stmt = $db->query('SELECT id, redirect_status FROM voting_sessions WHERE is_finalized = TRUE AND redirect_status IS NOT NULL ORDER BY updated_at DESC LIMIT 1');
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    echo json_encode([
        'redirect_status' => $result ? $result['redirect_status'] : null,
        'session_id' => $result ? $result['id'] : null
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}

