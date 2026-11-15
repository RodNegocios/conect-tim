<?php
require __DIR__ . '/../../app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$action = $_GET['action'] ?? 'catalog'; if (!is_string($action)) fail('Operação inválida.',400); $method = $_SERVER['REQUEST_METHOD'];
function send(array $data): never { echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); exit; }
if ($action === 'catalog' && $method === 'GET') { $s = store(); $s['products'] = array_values(array_filter($s['products'],fn($p)=>$p['active'])); send($s); }
if ($action === 'quote' && $method === 'POST') send(quote(input()));
if ($action === 'session' && $method === 'GET') { sessionStart(); send(['authenticated'=>!empty($_SESSION['admin']),'installed'=>!empty(readData('auth')['hash']),'configured'=>strlen($config['installation_key']) >= 32,'csrf'=>$_SESSION['csrf']]); }
if (in_array($action,['login','setup'],true) && $method === 'POST') {
    csrf(); $d=input(); $ip=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown'); $now=time();
    $limited=false;
    writeData('attempts',function($all) use ($ip,$now,&$limited) {
        $all=array_filter($all,fn($v)=>$v['until']>$now);
        foreach ([$ip,'global'] as $key) {
            $row=$all[$key] ?? ['count'=>0,'until'=>$now+900];
            if ($row['count'] >= ($key==='global'?100:10)) $limited=true;
            $row['count']++; $all[$key]=$row;
        }
        return $all;
    });
    if ($limited) { header('Retry-After: 900'); fail('Muitas tentativas. Aguarde 15 minutos.',429); }
    $password=textValue($d['password'] ?? '',128,true);
    if ($action==='setup') {
        if (strlen($config['installation_key'])<32 || !hash_equals($config['installation_key'],(string)($d['key'] ?? ''))) fail('Chave de instalação inválida.',403);
        if (strlen($password)<12) fail('Use uma senha com pelo menos 12 caracteres.');
        writeData('auth',function($old) use ($password) { if (!empty($old['hash'])) fail('O administrador já foi configurado.',409); return ['hash'=>password_hash($password,PASSWORD_DEFAULT)]; });
    } else {
        $hash=readData('auth')['hash'] ?? '';
        if (!$hash || !password_verify($password,$hash)) fail('Senha inválida.',401);
        if (password_needs_rehash($hash,PASSWORD_DEFAULT)) writeData('auth',fn($old)=>['hash'=>password_hash($password,PASSWORD_DEFAULT)]);
    }
    writeData('attempts',function($all) use($ip) { unset($all[$ip]); return $all; });
    session_regenerate_id(true); $_SESSION['auth_version']=hash('sha256',readData('auth')['hash']); $_SESSION['admin']=true; $_SESSION['last']=time(); $_SESSION['csrf']=bin2hex(random_bytes(32));
    send(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
}
admin();
if ($action==='store' && $method==='GET') send(store());
if ($action==='backup' && $method==='GET') { header('Content-Disposition: attachment; filename="connect-catalogo-'.gmdate('Ymd-His').'.json"'); send(store()); }
if ($method !== 'POST') fail('Operação não encontrada.',404);
csrf();
if ($action==='logout') { $_SESSION=[]; session_destroy(); setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']); send(['ok'=>true]); }
if ($action==='upload') {
    $f=$_FILES['image'] ?? null;
    if (!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>5*1024*1024) fail('Envie uma imagem de até 5 MB.');
    if (!is_uploaded_file($f['tmp_name'])) fail('Upload inválido.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!in_array($mime,['image/jpeg','image/png','image/webp'],true)) fail('Use apenas JPG, PNG ou WebP.');
    $size=@getimagesize($f['tmp_name']);
    if (!$size || $size[0]<1 || $size[1]<1 || $size[0]*$size[1]>16000000 || max($size[0],$size[1])>6000) fail('Imagem inválida ou maior que 16 megapixels.');
    if (!function_exists('imagecreatefromstring')) fail('A extensão GD precisa estar habilitada.',503);
    $im=@imagecreatefromstring(file_get_contents($f['tmp_name'])); if (!$im) fail('Imagem inválida.');
    if (max($size[0],$size[1])>1800) { $scaled=imagescale($im,(int)round($size[0]*1800/max($size[0],$size[1]))); imagedestroy($im); $im=$scaled; }
    $path='/uploads/'.bin2hex(random_bytes(20)).'.webp'; $file=PUBLIC_ROOT.$path;
    try { if (!imagewebp($im,$file,85)) fail('Não foi possível salvar a imagem.',503); chmod($file,0644); } finally { imagedestroy($im); }
    send(['path'=>$path]);
}
$d=input();
if ($action==='password') {
    $password=textValue($d['password'] ?? '',128,true);
    if (strlen($password)<12) fail('Use pelo menos 12 caracteres.');
    writeData('auth', function($old) use($d,$password) { if (!password_verify((string)($d['current'] ?? ''),$old['hash'])) fail('Senha atual inválida.',403); return ['hash'=>password_hash($password,PASSWORD_DEFAULT)]; });
    $_SESSION['auth_version']=hash('sha256',readData('auth')['hash']); session_regenerate_id(true); send(['ok'=>true]);
}
if (!in_array($action,['product-save','product-delete','settings-save','categories-save','demo-clear'],true)) fail('Operação não encontrada.',404);
$result=writeData('store',function($s) use($action,$d) {
    if (($d['revision'] ?? null)!==$s['revision']) fail('O catálogo mudou em outra aba. Recarregue o painel antes de salvar.',409);
    if ($action==='product-save') {
        if (!is_array($d['product'] ?? null)) fail('Produto inválido.');
        $p=validateProduct($d['product'],$s['categories']); $found=false;
        foreach ($s['products'] as &$row) { if ($row['id']===$p['id']) { $row=$p; $found=true; break; } } unset($row);
        if (!$found) { if (count($s['products'])>=1000) fail('Limite de 1.000 produtos atingido.'); $s['products'][]=$p; }
    } elseif ($action==='product-delete') {
        $s['products']=array_values(array_filter($s['products'],fn($p)=>$p['id']!==($d['id'] ?? '')));
    } elseif ($action==='demo-clear') {
        $s['products']=array_values(array_filter($s['products'],fn($p)=>!$p['demo']));
    } elseif ($action==='settings-save') {
        if (!is_array($d['settings'] ?? null)) fail('Configurações inválidas.');
        $s['settings']=validateSettings($d['settings']);
    } elseif ($action==='categories-save') {
        if (!is_array($d['categories'] ?? null) || count($d['categories'])>40) fail('Use até 40 categorias.');
        $categories=array_values(array_unique(array_map(fn($v)=>textValue($v,60,true),$d['categories'])));
        foreach ($s['products'] as $p) if (!in_array($p['category'],$categories,true)) fail('Mova ou exclua os produtos antes de remover sua categoria.');
        $s['categories']=$categories;
    }
    $s['revision']++; return $s;
},store());
send($result);
