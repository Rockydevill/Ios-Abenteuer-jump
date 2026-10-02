<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET' || (string)($_GET['probe'] ?? '') !== 'GBD-2026-10-02-018') {
    http_response_code(404);
    echo json_encode(['ok'=>false,'error'=>'not_found']);
    exit;
}
$root=__DIR__;
$out=['ok'=>true,'probe'=>'GBD-2026-10-02-018'];
foreach (['htaccess'=>'.htaccess','gateway'=>'gbd-storage-gateway.php'] as $name=>$rel) {
    $p=$root.'/'.$rel;
    $out[$name]=[
        'exists'=>is_file($p),
        'sha256'=>is_file($p)?hash_file('sha256',$p):null,
        'bytes'=>is_file($p)?filesize($p):null,
    ];
}
echo json_encode($out, JSON_UNESCAPED_SLASHES);
