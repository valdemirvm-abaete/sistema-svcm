<?php
header('Content-Type: application/json');
require_once 'db_config.php';

function encryptPassword($password) {
    $salt = "9f8f6d5s43a2a2d45fd6v7c8c9b9n9mm0hg9h9h9d09j9k9l9li9i0y0t0t0f9g8h8e8e";
    $saltedPassword = $password . $salt;
    $hash = hash('sha256', $saltedPassword);
    return substr(base64_encode($hash), 0, 60);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método inválido. Use POST.');
    }

    if (!isset($_POST['password']) || empty($_POST['password'])) {
        throw new Exception('Senha não fornecida.');
    }

    $password = $_POST['password'];

    if (!preg_match('/^[0-9]{6}$/', $password)) {
        throw new Exception('A senha deve conter exatamente 6 dígitos numéricos.');
    }

    $db = getDbConnection();
    $encryptedPassword = encryptPassword($password);

    // Find user by encrypted password
    $stmt = $db->prepare('SELECT id, nome, nivel FROM users WHERE BINARY senha = ?');
    $stmt->execute([$encryptedPassword]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception('Senha inválida.');
    }

    // Generate a secure token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    
    // Remove any existing tokens for this user
    $stmt = $db->prepare('DELETE FROM tokens WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    
    // Store new token in database
    $stmt = $db->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$user['id'], $token, $expiresAt]);

    // Return success response
    echo json_encode([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'nome' => $user['nome'],
            'nivel' => $user['nivel']
        ]
    ]);

} catch (PDOException $e) {
    error_log('Database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro de conexão com o banco de dados.',
        'details' => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}