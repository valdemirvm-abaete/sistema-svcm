<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $session_datetime = $_POST['session_datetime'] ?? '';
    $title = $_POST['title'] ?? '';
    $description = $_POST['description'] ?? '';
    
    if (empty($session_datetime)) throw new Exception('Data e hora são obrigatórios');
    if (empty($title)) throw new Exception('Título é obrigatório');
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    $stmt = $db->prepare('INSERT INTO voting_sessions (session_datetime, title, description, favorable_votes, contrary_votes, abstention_votes) VALUES (?, ?, ?, 0, 0, 0)');
    $stmt->execute([$session_datetime, $title, $description]);
    
    $newSessionId = $db->lastInsertId();
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Sessão criada com sucesso',
        'id' => $newSessionId
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}