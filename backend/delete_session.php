<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    
    if (!$id) throw new Exception('ID da sessão é obrigatório');
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // Delete votes first
    $stmt = $db->prepare('DELETE FROM votes WHERE session_id = ?');
    $stmt->execute([$id]);
    
    // Then delete session
    $stmt = $db->prepare('DELETE FROM voting_sessions WHERE id = ?');
    $stmt->execute([$id]);
    
    $db->commit();
    
    echo json_encode(['success' => true]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}