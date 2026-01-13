<?php
header('Content-Type: application/json');
require_once 'db_config.php';
require_once 'auth_check.php';

try {
    $user = requireAdmin();
    
    $id = $_POST['id'] ?? null;

    if (!$id) {
        throw new Exception('ID do vereador não fornecido');
    }

    $db = getDbConnection();
    
    // Begin transaction
    $db->beginTransaction();
    
    // Delete from votes table first
    $stmt = $db->prepare('DELETE FROM votes WHERE user_id = ?');
    $stmt->execute([$id]);

    // Delete associated tokens before deleting the user
    $stmt = $db->prepare('DELETE FROM tokens WHERE user_id = ?');
    $stmt->execute([$id]);
    
    // Get the foto path before deleting
    $stmt = $db->prepare('SELECT foto FROM users WHERE id = ? AND nivel = "vereador"');
    $stmt->execute([$id]);
    $vereador = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$vereador) {
        // If vereador not found, rollback and throw error, but it's possible the user was already deleted somehow
        // Let's check if tokens/votes were deleted and commit if so, otherwise rollback
        $votesDeleted = $db->prepare('SELECT COUNT(*) FROM votes WHERE user_id = ?');
        $votesDeleted->execute([$id]);
        $tokensDeleted = $db->prepare('SELECT COUNT(*) FROM tokens WHERE user_id = ?');
        $tokensDeleted->execute([$id]);

        if ($votesDeleted->fetchColumn() == 0 && $tokensDeleted->fetchColumn() == 0) {
             // Maybe the user was already deleted, but related data cleaned up. Commit cleanup.
             $db->commit();
             // Optionally inform the user the record might have already been deleted
             echo json_encode(['success' => true, 'message' => 'Vereador não encontrado ou já excluído. Registros associados limpos.']);
             exit;
        } else {
            // Something is inconsistent
            $db->rollBack();
            throw new Exception('Vereador não encontrado, mas dados associados ainda existem. Exclusão cancelada.');
        }
    }
    
    // Delete the vereador
    $stmt = $db->prepare('DELETE FROM users WHERE id = ? AND nivel = "vereador"');
    $stmt->execute([$id]);

    // Check if deletion was successful
    if ($stmt->rowCount() === 0) {
         // If no rows were affected, the user might not exist or not be a vereador
         // Rollback potential changes to votes/tokens if the user wasn't actually deleted now
         $db->rollBack();
         throw new Exception('Falha ao excluir o vereador. Registro não encontrado ou não é um vereador.');
    }
    
    // Delete the photo file if it's not the default avatar
    if ($vereador['foto'] && $vereador['foto'] !== 'img/avatar.jpg') {
        // Adjust path assuming 'img/' is directly under the web root, and backend is one level deeper
        $fotoPath = dirname(__DIR__) . '/' . $vereador['foto']; 
        if (file_exists($fotoPath)) {
            @unlink($fotoPath); // Use @ to suppress errors if unlink fails (e.g., permissions)
        }
    }
    
    $db->commit();
    
    echo json_encode(['success' => true, 'message' => 'Vereador excluído com sucesso']);
    
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) { // Check if in transaction before rolling back
        $db->rollBack();
    }
    http_response_code(400);
    // Provide a more specific error message if it's the constraint violation
    if (strpos($e->getMessage(), '1451') !== false) {
         error_log("Constraint violation during vereador deletion: " . $e->getMessage()); // Log the full error
         echo json_encode(['error' => 'Não foi possível excluir o vereador devido a registros associados. Verifique se há dados dependentes.']);
    } else {
         echo json_encode(['error' => $e->getMessage()]);
    }
}