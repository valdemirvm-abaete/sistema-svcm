<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $id = $_POST['id'] ?? null;
    $activate = filter_var($_POST['activate'] ?? false, FILTER_VALIDATE_BOOLEAN);
    
    if (!$id) throw new Exception('ID da sessão é obrigatório');
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // If activating, deactivate all other sessions first
    if ($activate) {
        $stmt = $db->prepare('UPDATE voting_sessions SET is_active = FALSE WHERE id != ?');
        $stmt->execute([$id]);
    }
    
    // Update target session
    $stmt = $db->prepare('UPDATE voting_sessions SET is_active = ? WHERE id = ?');
    $stmt->execute([$activate, $id]);
    
    $db->commit();
    
    echo json_encode(['success' => true]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}