<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow requests from any origin
header('Access-Control-Allow-Headers: Authorization, Content-Type'); // Keep allowing headers if needed elsewhere
require_once 'db_config.php';
// require_once 'auth_check.php'; // Removed authentication requirement for this public endpoint

try {
    // Authentication check removed - This endpoint now provides public data
    // $user = requireAuth(); 
    
    $db = getDbConnection();
    // Select only necessary public fields
    $stmt = $db->query('SELECT id, nome, partido, foto, can_vote FROM users WHERE nivel = "vereador" ORDER BY nome'); 
    $vereadores = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($vereadores);
    
} catch (PDOException $e) {
    error_log("Database error in list_vereadores.php: " . $e->getMessage()); // Log the error server-side
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
} catch (Exception $e) { // Catch other potential exceptions
    error_log("General error in list_vereadores.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An internal server error occurred.']);
}