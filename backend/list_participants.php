<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $db = getDbConnection();
    $stmt = $db->query('SELECT id as vereador_id FROM users WHERE nivel = "vereador" AND can_vote = TRUE');
    $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($participants);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

