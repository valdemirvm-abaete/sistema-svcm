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
    
    // Check if session exists
    $stmt = $db->prepare('SELECT id FROM voting_sessions WHERE id = ?');
    $stmt->execute([$id]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$session) {
        throw new Exception('Sessão não encontrada');
    }
    
    // Finalize the session: deactivate and mark as finalized
    $stmt = $db->prepare('UPDATE voting_sessions SET is_active = FALSE, is_finalized = TRUE, redirect_status = NULL WHERE id = ?');
    $stmt->execute([$id]);
    
    $db->commit();
    
    echo json_encode(['success' => true, 'message' => 'Votação finalizada com sucesso']);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
