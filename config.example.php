<?php
// Copie para config.local.php. A regra da raiz bloqueia acesso HTTP. Nunca envie credenciais ao Git.
return [
    'environment' => 'production',
    'installation_key' => '', // Gere: php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    'data_dir' => dirname(__DIR__) . '/connect-cell-private-' . substr(hash('sha256', realpath(__DIR__)), 0, 12), // Diretório privado, fora de public_html.
    'session_timeout' => 1800,
];
