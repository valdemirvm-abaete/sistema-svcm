<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    // Verify user is a vereador and can vote
    $user = requireAuth();
    
    if ($user['nivel'] !== 'vereador') {
        throw new Exception('Apenas vereadores podem votar');
    }
    
    // Check if vereador can vote
    $db = getDbConnection();
    $stmt = $db->prepare('SELECT can_vote FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $canVote = $stmt->fetchColumn();
    
    if (!$canVote) {
        throw new Exception('Vereador não está habilitado para votar nesta sessão');
    }
    
    // Get vote type from request
    $voteType = $_POST['vote'] ?? '';
    if (!in_array($voteType, ['favorable', 'contrary', 'abstention'])) {
        throw new Exception('Tipo de voto inválido');
    }

    // Get active session
    $stmt = $db->query('SELECT id FROM voting_sessions WHERE is_active = TRUE LIMIT 1');
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$session) {
        throw new Exception('Nenhuma votação ativa no momento');
    }
    
    // Begin transaction
    $db->beginTransaction();
    
    // Check if user already voted in this session
    $stmt = $db->prepare('SELECT vote_type FROM votes WHERE session_id = ? AND user_id = ?');
    $stmt->execute([$session['id'], $user['id']]);
    $existingVote = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingVote) {
        // Update existing vote
        if ($existingVote['vote_type'] !== $voteType) {
            // Decrement old vote count
            $oldColumn = $existingVote['vote_type'] . '_votes';
            $db->prepare("UPDATE voting_sessions SET $oldColumn = $oldColumn - 1 WHERE id = ?")->execute([$session['id']]);
            
            // Update vote
            $stmt = $db->prepare('UPDATE votes SET vote_type = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?');
            $stmt->execute([$voteType, $session['id'], $user['id']]);
            
            // Increment new vote count
            $newColumn = $voteType . '_votes';
            $db->prepare("UPDATE voting_sessions SET $newColumn = $newColumn + 1 WHERE id = ?")->execute([$session['id']]);
        }
    } else {
        // Insert new vote
        $stmt = $db->prepare('INSERT INTO votes (session_id, user_id, vote_type) VALUES (?, ?, ?)');
        $stmt->execute([$session['id'], $user['id'], $voteType]);
        
        // Increment vote count
        $column = $voteType . '_votes';
        $db->prepare("UPDATE voting_sessions SET $column = $column + 1 WHERE id = ?")->execute([$session['id']]);
    }
    
    $db->commit();
    
    // Return updated vote counts
    $stmt = $db->prepare('SELECT favorable_votes, contrary_votes, abstention_votes FROM voting_sessions WHERE id = ?');
    $stmt->execute([$session['id']]);
    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}