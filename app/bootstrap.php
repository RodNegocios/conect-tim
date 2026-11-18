<?php
declare(strict_types=1);
const ROOT = __DIR__ . '/..';
$config = ['environment' => getenv('CONNECT_ENV') ?: 'production', 'installation_key' => '', 'data_dir' => is_dir(ROOT . '/storage') ? ROOT . '/storage' : dirname(realpath(ROOT)) . '/connect-cell-private-' . substr(hash('sha256', realpath(ROOT)), 0, 12), 'session_timeout' => 1800];
$configFile = getenv('CONNECT_CONFIG_FILE') ?: ROOT . '/config.local.php';
if (is_file($configFile)) $config = array_replace($config, require $configFile);
$config['public_dir'] ??= is_dir(ROOT . '/public_html') ? ROOT . '/public_html' : ROOT . '/public';
define('PUBLIC_ROOT', realpath($config['public_dir']));
if (getenv('CONNECT_DATA_DIR')) $config['data_dir'] = getenv('CONNECT_DATA_DIR');
ini_set('display_errors', '0');
umask(0077);
function fail(string $message, int $status = 422): never { throw new RuntimeException($message, $status); }
set_exception_handler(function(Throwable $e): void {
    $status = in_array($e->getCode(), [400,401,403,404,405,409,413,422,429,503], true) ? $e->getCode() : 500;
    if ($status === 500) error_log('Connect Cell: internal failure (' . get_class($e) . ')');
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $status === 500 ? 'Não foi possível concluir. Consulte o responsável pela loja.' : $e->getMessage()], JSON_UNESCAPED_UNICODE);
});
$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (PHP_SAPI !== 'cli' && $config['environment'] !== 'development' && !$secure) fail('Use HTTPS para acessar a loja.', 403);
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
if ($secure) header('Strict-Transport-Security: max-age=31536000');
if (!is_dir($config['data_dir']) && !mkdir($config['data_dir'], 0700, true)) fail('Armazenamento indisponível.', 503);
$private = realpath($config['data_dir']); $public = PUBLIC_ROOT;
if (!$private || $private === $public || str_starts_with($private, $public . DIRECTORY_SEPARATOR)) fail('O diretório de dados precisa estar fora da pasta pública.', 503);
function readData(string $name, array $default = []): array {
    global $config;
    $file = $config['data_dir'] . '/' . $name . '.json';
    if (!is_file($file)) return $default;
    $data = json_decode((string)file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($data)) fail('Dados indisponíveis. Restaure um backup verificado.', 503);
    return $data;
}
function writeData(string $name, callable $change, array $default = []): array {
    global $config;
    $dir = $config['data_dir']; $lock = fopen($dir . '/' . $name . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) fail('Armazenamento ocupado.', 503);
    $temp = null;
    try {
        $old = readData($name, $default); $next = $change($old);
        if ($name === 'store' && $old === $next && is_file($dir . '/store.json')) return $next;
        $json = json_encode($next, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $file = $dir . '/' . $name . '.json';
        if ($name === 'store' && is_file($file)) {
            $backupDir = $dir . '/backups';
            if (!is_dir($backupDir)) mkdir($backupDir, 0700);
            if (!copy($file, $backupDir . '/store-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json')) fail('Não foi possível criar o backup.', 503);
            $backups = glob($backupDir . '/*.json'); sort($backups);
            while (count($backups) > 30) unlink(array_shift($backups));
        }
        $temp = tempnam($dir, '.write-'); $h = fopen($temp, 'wb');
        if (!$h) fail('Armazenamento indisponível.', 503);
        try { if (fwrite($h, $json) !== strlen($json) || !fflush($h)) fail('Falha ao salvar.', 503); if (function_exists('fsync')) fsync($h); } finally { fclose($h); }
        if (!rename($temp, $file)) fail('Falha ao salvar.', 503);
        return $next;
    } finally { if ($temp && is_file($temp)) unlink($temp); flock($lock, LOCK_UN); fclose($lock); }
}
function store(): array {
    global $config;
    $file = $config['data_dir'] . '/store.json';
    $existing = readData('store');
    if (($existing['catalogVersion'] ?? 0) >= 1) return $existing;

    return writeData('store', function(array $data) use ($file): array {
        // Recheck under the write lock in case another request completed the upgrade.
        if (($data['catalogVersion'] ?? 0) >= 1) return $data;
        $installed = is_file($file);
        if (!$installed) {
            $data = json_decode(file_get_contents(ROOT . '/seed/demo.json'), true, 64, JSON_THROW_ON_ERROR);
        }
        if (!is_array($data['products'] ?? null) || !is_array($data['categories'] ?? null) || !is_int($data['revision'] ?? null)) {
            fail('Catálogo inválido. Restaure um backup verificado.', 503);
        }

        $phones = json_decode(file_get_contents(ROOT . '/seed/iphones.json'), true, 64, JSON_THROW_ON_ERROR);
        $ids = array_column($data['products'], 'id');
        $names = array_map('mb_strtolower', array_column($data['products'], 'name'));
        foreach ($phones as $phone) {
            if (in_array($phone['id'], $ids, true) || in_array(mb_strtolower($phone['name']), $names, true)) continue;
            if (count($data['products']) >= 1000) break;
            if (!in_array($phone['category'], $data['categories'], true)) {
                if (count($data['categories']) >= 40) break;
                $data['categories'][] = $phone['category'];
            }
            $data['products'][] = $phone;
        }
        $data['catalogVersion'] = 1;
        if ($installed) $data['revision']++;
        return $data;
    });
}
function sessionStart(): void {
    global $secure, $config;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('connect_admin');
    session_save_path($config['data_dir']);
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['httponly'=>true,'secure'=>$secure,'samesite'=>'Strict','path'=>'/']);
    session_start();
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > $config['session_timeout']) { $_SESSION = []; session_regenerate_id(true); }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    if (!empty($_SESSION['admin'])) {
        if (!hash_equals(hash('sha256', readData('auth')['hash'] ?? ''), $_SESSION['auth_version'] ?? '')) { $_SESSION = ['csrf'=>bin2hex(random_bytes(32))]; session_regenerate_id(true); }
        else $_SESSION['last'] = time();
    }
}
function admin(): void { sessionStart(); if (empty($_SESSION['admin'])) fail('Entre no painel para continuar.', 401); }
function csrf(): void { sessionStart(); if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Sessão inválida. Atualize a página.', 403); }
function input(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) fail('Conteúdo muito grande.', 413);
    try { $d = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR); } catch (JsonException) { fail('JSON inválido.', 400); }
    if (!is_array($d)) fail('Dados inválidos.', 400);
    return $d;
}
function textValue(mixed $v, int $max, bool $required = false): string {
    if (!is_string($v) || mb_strlen($v) > $max || ($required && trim($v) === '')) fail('Texto inválido ou muito longo.');
    return trim($v);
}
function imagePath(mixed $v): string {
    $v = textValue($v, 180);
    if ($v !== '' && (!preg_match('~^/(assets|uploads)/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$~D', $v) || !is_file(PUBLIC_ROOT . $v))) fail('Imagem inválida. Envie o arquivo pelo painel.');
    return $v;
}
function moneyValue(mixed $v): ?int {
    if ($v === null || $v === '') return null;
    if (!is_int($v) || $v < 0 || $v > 100000000) fail('Preço inválido.');
    return $v;
}
function validateProduct(array $d, array $categories): array {
    $p = [];
    $p['id'] = textValue($d['id'] ?? '', 60);
    if ($p['id'] !== '' && !preg_match('/^[a-zA-Z0-9_-]+$/D', $p['id'])) fail('Identificador inválido.');
    $p['id'] = $p['id'] ?: bin2hex(random_bytes(12));
    $p['name'] = textValue($d['name'] ?? '', 120, true);
    $p['description'] = textValue($d['description'] ?? '', 5000);
    $p['category'] = textValue($d['category'] ?? '', 60, true);
    if (!in_array($p['category'], $categories, true)) fail('Selecione uma categoria existente.');
    $p['price'] = moneyValue($d['price'] ?? null); $p['salePrice'] = moneyValue($d['salePrice'] ?? null);
    if ($p['salePrice'] !== null && ($p['price'] === null || $p['salePrice'] >= $p['price'])) fail('O preço promocional deve ser menor que o preço regular.');
    $p['image'] = imagePath($d['image'] ?? '');
    if (!is_array($d['gallery'] ?? []) || count($d['gallery'] ?? []) > 8) fail('Use até oito imagens na galeria.');
    $p['gallery'] = array_values(array_unique(array_map('imagePath', $d['gallery'] ?? [])));
    foreach (['active','available','featured','demo'] as $key) { if (!is_bool($d[$key] ?? null)) fail('Status inválido.'); $p[$key] = $d[$key]; }
    if (!is_int($d['order'] ?? null) || abs($d['order']) > 100000) fail('Ordem inválida.');
    $p['order'] = $d['order'];
    $variations = $d['variations'] ?? [];
    if (!is_array($variations) || count($variations) > 4) fail('Use até quatro grupos de variações.');
    $p['variations'] = []; $names = [];
    foreach ($variations as $v) {
        if (!is_array($v)) fail('Variação inválida.');
        $name = textValue($v['name'] ?? '', 50, true);
        if (in_array($name, $names, true) || !is_array($v['options'] ?? null) || count($v['options']) < 1 || count($v['options']) > 20) fail('Opções de variação inválidas.');
        $names[] = $name;
        $p['variations'][] = ['name'=>$name, 'options'=>array_values(array_unique(array_map(fn($o)=>textValue($o,60,true),$v['options'])))];
    }
    return $p;
}
function validateSettings(array $d): array {
    $s = [];
    foreach (['name'=>100,'tagline'=>150,'heroTitle'=>120,'heroText'=>350,'about'=>2000,'address'=>250,'hours'=>300,'phone'=>40,'campaign'=>180] as $k=>$max) $s[$k] = textValue($d[$k] ?? '',$max,in_array($k,['name','heroTitle']));
    $s['whatsapp'] = textValue($d['whatsapp'] ?? '',15);
    if ($s['whatsapp'] !== '' && !preg_match('/^[1-9][0-9]{9,14}$/D',$s['whatsapp'])) fail('Informe o WhatsApp com país e DDD, somente números.');
    foreach (['instagram','facebook'] as $k) { $s[$k] = textValue($d[$k] ?? '',300); if ($s[$k] !== '' && (!filter_var($s[$k],FILTER_VALIDATE_URL) || parse_url($s[$k],PHP_URL_SCHEME) !== 'https' || parse_url($s[$k],PHP_URL_USER))) fail('Use um link HTTPS válido.'); }
    foreach (['logo','heroImage','aboutImage'] as $k) $s[$k] = imagePath($d[$k] ?? '');
    return $s;
}
function brl(?int $v): string { return $v === null ? 'Sob consulta' : 'R$ ' . number_format($v/100,2,',','.'); }
function quote(array $data): array {
    $store = store(); $items = $data['items'] ?? [];
    if (!is_array($items) || count($items) < 1 || count($items) > 50) fail('Adicione de 1 a 50 itens ao carrinho.');
    $phone = $store['settings']['whatsapp']; if (!$phone) fail('O WhatsApp ainda não foi configurado. Entre em contato com a loja.');
    $catalog = array_column($store['products'],null,'id'); $lines = []; $total = 0; $unknown = false;
    foreach ($items as $i=>$item) {
        if (!is_array($item)) fail('Item inválido.');
        $id=textValue($item['id'] ?? '',60,true);
        $p = $catalog[$id] ?? null; $qty = $item['quantity'] ?? null; $selection = $item['variations'] ?? [];
        if (!$p || !$p['active'] || !$p['available']) fail('Um produto ficou indisponível. Atualize o carrinho.',409);
        if (!is_int($qty) || $qty<1 || $qty>99 || !is_array($selection) || count($selection)!==count($p['variations'])) fail('Quantidade ou variação inválida.');
        $options = [];
        foreach ($p['variations'] as $v) { $opt=$selection[$v['name']] ?? null; if (!in_array($opt,$v['options'],true)) fail('Selecione as variações atuais do produto.',409); $options[]=$v['name'].': '.$opt; }
        $price=$p['salePrice'] ?? $p['price']; $subtotal=$price === null ? null : $price*$qty;
        $total += $subtotal ?? 0; $unknown = $unknown || $subtotal === null;
        $lines[] = ($i+1).'. '.$p['name'].($p['demo']?' [DEMONSTRAÇÃO]':'')."\nQuantidade: ".$qty.($options?"\nVariação: ".implode(', ',$options):'')."\nSubtotal: ".brl($subtotal);
    }
    $name=textValue($data['name'] ?? '',100); $notes=textValue($data['notes'] ?? '',1000);
    $message="Olá! Gostaria de fazer o seguinte pedido:\n\n".implode("\n\n",$lines)."\n\nTotal estimado: ".($unknown?($total?brl($total).' + itens sob consulta':'A confirmar'):brl($total));
    if ($name) $message.="\nNome: ".$name; if ($notes) $message.="\nObservações: ".$notes;
    $message.="\n\nPoderia confirmar a disponibilidade e o valor final?";
    $url='https://wa.me/'.$phone.'?text='.rawurlencode($message);
    if (strlen($url)>7500) fail('Pedido muito longo para o WhatsApp. Reduza os itens ou as observações.');
    return ['url'=>$url,'message'=>$message,'total'=>$total,'hasUnpriced'=>$unknown];
}
