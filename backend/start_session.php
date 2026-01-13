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
    
    // Check if session is finalized - if so, cannot start
    $stmt = $db->prepare('SELECT is_finalized FROM voting_sessions WHERE id = ?');
    $stmt->execute([$id]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$session) {
        throw new Exception('Sessão não encontrada');
    }
    
    if ($session['is_finalized']) {
        throw new Exception('Não é possível iniciar uma votação finalizada. Zerar os votos primeiro para permitir novo início.');
    }
    
    // Deactivate all other sessions first
    $stmt = $db->prepare('UPDATE voting_sessions SET is_active = FALSE WHERE id != ?');
    $stmt->execute([$id]);
    
    // Activate target session
    $stmt = $db->prepare('UPDATE voting_sessions SET is_active = TRUE, redirect_status = NULL WHERE id = ?');
    $stmt->execute([$id]);
    
    $db->commit();
    
    echo json_encode(['success' => true, 'message' => 'Votação iniciada com sucesso']);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
