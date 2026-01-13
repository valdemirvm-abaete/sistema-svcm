<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $id = $_POST['id'] ?? null;
    
    if (!$id) throw new Exception('ID da sessão é obrigatório');
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // Delete all votes for this session
    $stmt = $db->prepare('DELETE FROM votes WHERE session_id = ?');
    $stmt->execute([$id]);
    
    // Reset vote counts and allow session to be started again (reset is_finalized)
    $stmt = $db->prepare('UPDATE voting_sessions SET favorable_votes = 0, contrary_votes = 0, abstention_votes = 0, is_finalized = FALSE WHERE id = ?');
    $stmt->execute([$id]);
    
    $db->commit();
    
    echo json_encode(['success' => true, 'message' => 'Votos zerados com sucesso']);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}