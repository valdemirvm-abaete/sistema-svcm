<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php'; 

try {
    $user = requireAuth(); 
    
    $db = getDbConnection();
    $stmt = $db->prepare('SELECT can_vote FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$userData) {
        throw new Exception('Usuário autenticado não encontrado no banco de dados.');
    }

    $userStatus = [
        'id' => $user['id'],
        'nome' => $user['nome'],
        'nivel' => $user['nivel'],
        'can_vote' => (bool)$userData['can_vote'] 
    ];
    
    echo json_encode($userStatus);
    
} catch (Exception $e) {
    http_response_code(500); 
    error_log("Error in get_user_status.php: " . $e->getMessage()); 
    echo json_encode(['error' => 'Erro ao buscar status do usuário.', 'details' => $e->getMessage()]); 
}
?>