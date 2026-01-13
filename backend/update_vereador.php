<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

// Function to encrypt password (copied from login.php/register_vereador.php for consistency)
function encryptPassword($password) {
    $salt = "9f8f6d5s43a2a2d45fd6v7c8c9b9n9mm0hg9h9h9d09j9k9l9li9i0y0t0t0f9g8h8e8e";
    $saltedPassword = $password . $salt;
    $hash = hash('sha256', $saltedPassword);
    return substr(base64_encode($hash), 0, 60);
}

try {
    // Require Admin access
    $user = requireAdmin();

    // --- Get Input Data ---
    $id = $_POST['id'] ?? null;
    $nome = $_POST['nome'] ?? '';
    $partido = $_POST['partido'] ?? '';
    $novaSenha = $_POST['senha'] ?? ''; // Get potential new password

    if (!$id) {
        throw new Exception('ID do vereador não fornecido.');
    }
    if (empty($nome)) {
        throw new Exception('Nome é obrigatório.');
    }
    if (empty($partido)) {
        throw new Exception('Partido é obrigatório.');
    }

    // --- Database Connection ---
    $db = getDbConnection();
    $db->beginTransaction(); // Start transaction

    // --- Fetch Current Vereador Data ---
    $stmt = $db->prepare('SELECT foto FROM users WHERE id = ? AND nivel = "vereador"');
    $stmt->execute([$id]);
    $currentVereador = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentVereador) {
        $db->rollBack();
        throw new Exception('Vereador não encontrado.');
    }

    $currentFoto = $currentVereador['foto'];
    $newFotoPath = $currentFoto; // Assume foto doesn't change initially
    $encryptedPassword = null; // Will hold encrypted password if provided

    // --- Handle New Password ---
    if (!empty($novaSenha)) {
        // Validate password format
        if (!preg_match('/^[0-9]{6}$/', $novaSenha)) {
            $db->rollBack();
            throw new Exception('A nova senha deve conter exatamente 6 dígitos numéricos.');
        }
        
        // Encrypt the new password
        $encryptedPassword = encryptPassword($novaSenha);
        
        // Check if the new password already exists for ANOTHER user
        $stmt = $db->prepare('SELECT id FROM users WHERE BINARY senha = ? AND id != ?');
        $stmt->execute([$encryptedPassword, $id]);
        if ($stmt->fetch()) {
            $db->rollBack();
            throw new Exception('Esta nova senha já está em uso por outro usuário. Por favor, escolha outra.');
        }
    }


    // --- Handle Photo Upload ---
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../img/'; // Relative to this script's location
        if (!file_exists($uploadDir)) {
            if (!mkdir($uploadDir, 0777, true)) {
                 $db->rollBack();
                 throw new Exception('Falha ao criar diretório de upload.');
            }
        }

        $fileInfo = $_FILES['foto'];
        $fileExtension = strtolower(pathinfo($fileInfo['name'], PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png'];

        if (!in_array($fileExtension, $allowedExtensions)) {
            $db->rollBack();
            throw new Exception('Formato de imagem inválido. Use JPG, JPEG ou PNG.');
        }

        if ($fileInfo['size'] > 5000000) { // 5MB limit
            $db->rollBack();
            throw new Exception('Arquivo muito grande. O limite é 5MB.');
        }

        $fileName = uniqid('user_' . $id . '_') . '.' . $fileExtension;
        $uploadFile = $uploadDir . $fileName;

        if (!move_uploaded_file($fileInfo['tmp_name'], $uploadFile)) {
            $db->rollBack();
            throw new Exception('Erro ao mover o arquivo de foto para o destino.');
        }

        // Delete old photo if it exists and is not the default avatar
        if ($currentFoto && $currentFoto !== 'img/avatar.jpg') {
            $oldFotoPath = dirname(__DIR__) . '/' . $currentFoto; // Correct path from project root
            if (file_exists($oldFotoPath)) {
                @unlink($oldFotoPath); // Suppress errors if unlink fails
            }
        }

        $newFotoPath = 'img/' . $fileName; // Path to store in DB
    }

    // --- Prepare and Execute SQL Update ---
    $sql = 'UPDATE users SET nome = ?, partido = ?, foto = ?, updated_at = CURRENT_TIMESTAMP';
    $params = [$nome, $partido, $newFotoPath];

    // Add password update if provided
    if ($encryptedPassword !== null) {
        $sql .= ', senha = ?';
        $params[] = $encryptedPassword;
    }

    $sql .= ' WHERE id = ? AND nivel = "vereador"';
    $params[] = $id;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // --- Commit Transaction ---
    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Vereador atualizado com sucesso!'
    ]);

} catch (Exception $e) {
    // Rollback transaction if it's active
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(400); // Bad request or validation error
    error_log("Error updating vereador: " . $e->getMessage()); // Log the error
    echo json_encode(['error' => $e->getMessage()]);
}