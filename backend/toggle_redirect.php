<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $id = $_POST['id'] ?? null;
    $redirectStatus = $_POST['redirect_status'] ?? null;
    
    if (!$id) throw new Exception('ID da sessão é obrigatório');
    if (!in_array($redirectStatus, ['to_results', 'to_live', null])) {
        throw new Exception('Status de redirecionamento inválido');
    }
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // If setting to 'to_results', reset all other sessions' redirect_status to NULL
    // This ensures only one session redirects to results at a time
    if ($redirectStatus === 'to_results') {
        $stmt = $db->prepare('UPDATE voting_sessions SET redirect_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id != ?');
        $stmt->execute([$id]);
    }
    
    // Update target session - handle NULL properly
    if ($redirectStatus === null) {
        $stmt = $db->prepare('UPDATE voting_sessions SET redirect_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->execute([$id]);
    } else {
        $stmt = $db->prepare('UPDATE voting_sessions SET redirect_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([$redirectStatus, $id]);
    }
    
    $db->commit();
    
    echo json_encode(['success' => true]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}