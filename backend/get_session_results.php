<?php
header('Content-Type: application/json');
require_once 'db_config.php';

try {
    $sessionId = $_GET['id'] ?? null;

    if (!$sessionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID da sessão não fornecido.']);
        exit;
    }

    $db = getDbConnection();

    // Fetch session details - No change here, this should always work regardless of is_active status
    $stmt = $db->prepare('SELECT id, session_datetime, title, description, favorable_votes, contrary_votes, abstention_votes FROM voting_sessions WHERE id = ?');
    $stmt->execute([$sessionId]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        http_response_code(404);
        echo json_encode(['error' => 'Sessão não encontrada.']);
        exit;
    }

    // Fetch participating vereadores AND their votes for this specific session
    // We join users and votes to get the vote_type for each user in this session
    $stmt = $db->prepare('
        SELECT u.id, u.nome, u.partido, u.foto, v.vote_type 
        FROM users u 
        INNER JOIN votes v ON u.id = v.user_id 
        WHERE v.session_id = ? AND u.nivel = "vereador" 
        ORDER BY u.nome
    ');
    $stmt->execute([$sessionId]);
    $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Add participants to session data
    $session['participants'] = $participants;

    echo json_encode($session);

} catch (Exception $e) {
    http_response_code(500);
    error_log("Error in get_session_results.php: " . $e->getMessage()); // Log the actual error
    echo json_encode(['error' => 'Erro interno ao buscar detalhes da sessão.']); // Generic message to user
}
?>