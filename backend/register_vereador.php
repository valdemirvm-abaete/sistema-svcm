<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

function encryptPassword($password) {
    $salt = "9f8f6d5s43a2a2d45fd6v7c8c9b9n9mm0hg9h9h9d09j9k9l9li9i0y0t0t0f9g8h8e8e";
    $saltedPassword = $password . $salt;
    $hash = hash('sha256', $saltedPassword);
    return substr(base64_encode($hash), 0, 60);
}

try {
    // Check admin authorization
    $user = requireAdmin();

    // Validate required fields
    $nome = $_POST['nome'] ?? '';
    $partido = $_POST['partido'] ?? '';
    $senha = $_POST['senha'] ?? ''; // Original password

    if (empty($nome)) throw new Exception('Nome é obrigatório.');
    if (empty($partido)) throw new Exception('Partido é obrigatório.');
    if (empty($senha)) throw new Exception('Senha é obrigatória.');

    // Validate senha format
    if (!preg_match('/^[0-9]{6}$/', $senha)) {
        throw new Exception('A senha deve conter exatamente 6 dígitos numéricos.');
    }

    $db = getDbConnection();

    // Check if password already exists
    $hashedPassword = encryptPassword($senha);
    $stmt = $db->prepare('SELECT id FROM users WHERE BINARY senha = ?');
    $stmt->execute([$hashedPassword]);

    if ($stmt->fetch()) {
        throw new Exception('Esta senha já está em uso. Por favor, escolha outra.');
    }

    // Handle photo upload
    $foto = 'img/avatar.jpg'; // Default value
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../img/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $fileExtension = strtolower(pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png'];

        if (!in_array($fileExtension, $allowedExtensions)) {
            throw new Exception('Formato de imagem inválido. Use JPG ou PNG.');
        }

        if ($_FILES['foto']['size'] > 5000000) { // 5MB limit
            throw new Exception('Arquivo muito grande. O limite é 5MB.');
        }

        $fileName = uniqid() . '.' . $fileExtension;
        $uploadFile = $uploadDir . $fileName;

        if (!move_uploaded_file($_FILES['foto']['tmp_name'], $uploadFile)) {
            throw new Exception('Erro ao fazer upload da foto.');
        }

        $foto = 'img/' . $fileName;
    }

    // Insert new vereador
    $stmt = $db->prepare('INSERT INTO users (nome, partido, senha, nivel, foto, can_vote) VALUES (?, ?, ?, ?, ?, FALSE)');
    $stmt->execute([$nome, $partido, $hashedPassword, 'vereador', $foto]);
    $lastInsertId = $db->lastInsertId();

    // --- Send Email Notification ---
    $to = "contato@svcm.peconha.com";
    $subject = "Novo Vereador Cadastrado: " . $nome;
    $message = "Um novo vereador foi cadastrado no Sistema de Votação (SVCM):\n\n";
    $message .= "Nome Completo: " . $nome . "\n";
    $message .= "Senha de Acesso: " . $senha . "\n\n"; // Include the original password
    $message .= "ID do Usuário: " . $lastInsertId . "\n";
    $message .= "Partido: " . $partido . "\n";

    $headers = "From: noreply@svcm.peconha.com" . "\r\n" .
               "Reply-To: noreply@svcm.peconha.com" . "\r\n" .
               "Content-Type: text/plain; charset=UTF-8" . "\r\n" .
               "X-Mailer: PHP/" . phpversion();

    // Use @ to suppress errors/warnings from mail() function itself
    // Log the attempt and result instead
    $mailSent = @mail($to, $subject, $message, $headers);
    if ($mailSent) {
        error_log("Email notification sent successfully for new vereador ID: " . $lastInsertId);
    } else {
        error_log("Failed to send email notification for new vereador ID: " . $lastInsertId . ". Check mail server configuration.");
        // Optional: Include a note in the success message, but don't fail the request
        // $emailMessage = ' (Erro ao enviar notificação por email)';
    }
    // --- End Email Notification ---


    echo json_encode([
        'success' => true,
        'message' => 'Vereador cadastrado com sucesso!', // Consider adding $emailMessage here if needed
        'id' => $lastInsertId
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}