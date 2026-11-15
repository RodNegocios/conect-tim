<?php
// Somente para o servidor de desenvolvimento PHP. Produção usa o document root público.
$root = realpath(__DIR__ . '/../public');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$file = realpath($root . $path);
$valid = $file && ($file === $root || str_starts_with($file, $root . DIRECTORY_SEPARATOR));
if ($valid && !preg_match('~(^|/)\.~', $path)) {
    if (in_array($path, ['/', '/admin/', '/api/'], true)) return false;
    if (is_file($file) && (pathinfo($file, PATHINFO_EXTENSION) !== 'php' || in_array($path, ['/index.php','/admin/index.php','/api/index.php'],true))) return false;
}
http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo 'Não encontrado.';
