<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');

function gbd_host_ok(string $value): bool {
    $value = strtolower(trim($value));
    if ($value === '') return false;
    $host = strtolower((string)parse_url(
        str_contains($value, '://') ? $value : 'https://' . $value,
        PHP_URL_HOST
    ));
    return in_array($host, ['gamesbehinddoors.de', 'www.gamesbehinddoors.de'], true);
}

if (!gbd_host_ok((string)($_SERVER['HTTP_HOST'] ?? ''))) {
    http_response_code(404);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && strtolower($origin) !== 'null' && !gbd_host_ok($origin)) {
        http_response_code(403);
        exit('Ungültige Anfragequelle.');
    }

    $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
    if ($referer !== '' && !gbd_host_ok($referer)) {
        http_response_code(403);
        exit('Ungültige Anfragequelle.');
    }

    $_SERVER['HTTP_HOST'] = 'gamesbehinddoors.de';
    $_SERVER['HTTP_ORIGIN'] = '';
}

require __DIR__ . '/gbd-storage-test.php';
