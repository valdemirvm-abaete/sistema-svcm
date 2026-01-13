<?php
header('Content-Type: application/json');
require_once 'db_config.php';

function getTokenFromHeader() {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return null;
    }
    
    return trim($matches[1]);
}

function validateToken($token) {
    try {
        $db = getDbConnection();
        // Check if token exists and is valid in the tokens table
        $stmt = $db->prepare('SELECT user_id, created_at FROM tokens WHERE token = ? AND expires_at > NOW()');
        $stmt->execute([$token]);
        $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tokenData) {
            return null;
        }
        
        return $tokenData['user_id'];
    } catch (Exception $e) {
        error_log('Error validating token: ' . $e->getMessage());
        return null;
    }
}

function getAuthenticatedUser() {
    $token = getTokenFromHeader();
    if (!$token) {
        return null;
    }
    
    $userId = validateToken($token);
    if (!$userId) {
        return null;
    }
    
    try {
        $db = getDbConnection();
        $stmt = $db->prepare('SELECT id, nome, nivel, partido FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log('Error in getAuthenticatedUser: ' . $e->getMessage());
        return null;
    }
}

function requireAuth() {
    $user = getAuthenticatedUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized access']);
        exit;
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if ($user['nivel'] !== 'administrador') {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        exit;
    }
    return $user;
}

function requireVereador() {
    $user = requireAuth();
    if ($user['nivel'] !== 'vereador') {
        http_response_code(403);
        echo json_encode(['error' => 'Vereador access required']);
        exit;
    }
    return $user;
}