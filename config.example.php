<?php
// Copie para config.local.php, FORA de public_html. Nunca envie credenciais ao Git.
return [
    'environment' => 'production',
    'installation_key' => '', // Gere: php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    'data_dir' => __DIR__ . '/storage', // Diretório privado, fora de public_html.
    'session_timeout' => 1800,
];
