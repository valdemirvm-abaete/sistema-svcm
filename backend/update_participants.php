<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    // Receber dados via POST ao invés de JSON
    $participants = $_POST['participants'] ?? [];
    
    // Validação adicional
    if (!is_array($participants)) {
        http_response_code(400);
        echo json_encode(['error' => 'Lista de participantes inválida']);
        exit;
    }
    
    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // First, set all vereadores to can_vote = FALSE
    $stmt = $db->prepare('UPDATE users SET can_vote = FALSE WHERE nivel = "vereador"');
    $stmt->execute();
    
    // Then, set selected vereadores to can_vote = TRUE
    if (!empty($participants)) {
        $placeholders = str_repeat('?,', count($participants) - 1) . '?';
        $stmt = $db->prepare("UPDATE users SET can_vote = TRUE WHERE id IN ($placeholders) AND nivel = 'vereador'");
        $stmt->execute(array_values($participants));
    }
    
    $db->commit();
    
    // Get updated list of participants for confirmation
    $stmt = $db->query('SELECT id as vereador_id FROM users WHERE nivel = "vereador" AND can_vote = TRUE');
    $updatedParticipants = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Participantes atualizados com sucesso',
        'participants' => $updatedParticipants
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}