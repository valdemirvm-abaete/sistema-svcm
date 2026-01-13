<?php
header('Content-Type: application/json');

// Return current voting results
// In a real implementation, this would fetch from a database
echo json_encode([
    'favorable' => 10,
    'contrary' => 4,
    'abstention' => 2
]);