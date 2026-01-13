<?php
header('Content-Type: application/json');
require_once 'db_config.php';

try {
    $db = getDbConnection();
    
    // Get active session
    $stmt = $db->query('SELECT * FROM voting_sessions WHERE is_active = TRUE LIMIT 1');
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($session) {
        // Get all votes for this session if there is an active one
        $votes = [];
        $voteStmt = $db->prepare('SELECT user_id, vote_type FROM votes WHERE session_id = ?');
        $voteStmt->execute([$session['id']]);
        while ($vote = $voteStmt->fetch(PDO::FETCH_ASSOC)) {
            $votes[$vote['user_id']] = $vote['vote_type'];
        }
        
        $session['votes'] = $votes;
    }
    
    echo json_encode([
        'active_session' => $session ?: null
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
