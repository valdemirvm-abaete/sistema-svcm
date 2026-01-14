<?php
// Server-Sent Events stream to broadcast redirect_status changes in near real-time
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
require_once 'db_config.php';

set_time_limit(0);
// If the client disconnects, stop the script
ignore_user_abort(false);

$lastSent = null;

while (!connection_aborted()) {
    try {
        $db = getDbConnection();

// Always fetch the currently active session (if any)
        $activeSessionStmt = $db->query("SELECT id, title, session_datetime, is_active, is_finalized, favorable_votes, contrary_votes, abstention_votes FROM voting_sessions WHERE is_active = TRUE LIMIT 1");
        $activeSession = $activeSessionStmt->fetch(PDO::FETCH_ASSOC);

        // If there's an active session, also fetch the votes mapping (user_id => vote_type)
        $votesMapping = null;
        if ($activeSession) {
            $voteStmt = $db->prepare('SELECT user_id, vote_type FROM votes WHERE session_id = ?');
            $voteStmt->execute([$activeSession['id']]);
            $votes = [];
            while ($v = $voteStmt->fetch(PDO::FETCH_ASSOC)) {
                $votes[(string)$v['user_id']] = $v['vote_type'];
            }
            $votesMapping = $votes;
        }

        // Prefer a session that has redirect_status set (active preferred, else latest finalized)
        $stmt = $db->query("SELECT id, redirect_status FROM voting_sessions WHERE is_active = TRUE AND redirect_status IS NOT NULL LIMIT 1");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$result) {
            $stmt = $db->query("SELECT id, redirect_status FROM voting_sessions WHERE is_finalized = TRUE AND redirect_status IS NOT NULL ORDER BY updated_at DESC LIMIT 1");
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        $payload = [
            'session_id' => $result ? (int)$result['id'] : null,
            'redirect_status' => $result ? $result['redirect_status'] : null,
            'active_session' => $activeSession ? [
                'id' => (int)$activeSession['id'],
                'title' => $activeSession['title'],
                'session_datetime' => $activeSession['session_datetime'],
                'is_active' => (bool)$activeSession['is_active'],
                'is_finalized' => (bool)$activeSession['is_finalized'],
                'favorable_votes' => (int)$activeSession['favorable_votes'],
                'contrary_votes' => (int)$activeSession['contrary_votes'],
                'abstention_votes' => (int)$activeSession['abstention_votes'],
                'votes' => $votesMapping
            ] : null
        ];

        $current = json_encode($payload);

        if ($current !== $lastSent) {
            echo "event: redirect\n";
            echo "data: {$current}\n\n";
            @ob_flush();
            @flush();
            $lastSent = $current;
        } else {
            // keep-alive comment to prevent some proxies from closing the connection
            echo ": keep-alive\n\n";
            @ob_flush();
            @flush();
        }

    } catch (Exception $e) {
        // Send minimal error event and continue
        echo "event: error\n";
        echo "data: {\"error\":\"database\"}\n\n";
        @ob_flush();
        @flush();
    }

    // Short sleep for responsiveness; tune as needed (1 second is aggressive but fast)
    sleep(1);
}

// Close connection gracefully
http_response_code(200);
exit;
