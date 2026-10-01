<?php
declare(strict_types=1);

/*
 * Games Behind Doors STRATO bridge.
 * This file only proxies two fixed public Edge Functions.
 * It never executes uploaded game HTML and never accepts arbitrary upstream URLs.
 */

const EDGE_BASE = 'https://voldtqsdqcdexkexwerp.supabase.co/functions/v1/';
$route = isset($_GET['route']) ? (string) $_GET['route'] : '';

if ($route === 'game' || $route === 'game_en') {
    $slug = isset($_GET['slug']) ? strtolower(trim((string) $_GET['slug'])) : '';
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,69}$/', $slug)) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex,follow');
        echo $route === 'game_en'
            ? '<!doctype html><meta charset="utf-8"><title>Game not found</title><h1>Game not found</h1>'
            : '<!doctype html><meta charset="utf-8"><title>Spiel nicht gefunden</title><h1>Spiel nicht gefunden</h1>';
        exit;
    }
    $edgeFunction = $route === 'game_en' ? 'gbd-game-page-en' : 'gbd-game-page';
    $upstream = EDGE_BASE . $edgeFunction . '?slug=' . rawurlencode($slug);
    $expectedType = 'text/html; charset=utf-8';
} elseif ($route === 'sitemap') {
    $upstream = EDGE_BASE . 'gbd-sitemap';
    $expectedType = 'application/xml; charset=utf-8';
} else {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo 'Not found';
    exit;
}

$responseHeaders = [];

if (!function_exists('curl_init')) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex,nofollow');
    error_log('GBD STRATO bridge: PHP cURL extension is unavailable.');
    echo 'Upstream unavailable';
    exit;
}

$ch = curl_init($upstream);
if ($ch === false) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo 'Upstream unavailable';
    exit;
}

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_USERAGENT => 'GamesBehindDoors-STRATO-Bridge/1.0',
    CURLOPT_HTTPHEADER => ['Accept: ' . ($route === 'game' ? 'text/html' : 'application/xml')],
    CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
        $length = strlen($header);
        $parts = explode(':', $header, 2);
        if (count($parts) === 2) {
            $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
        return $length;
    },
]);

$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($body === false || $status < 100) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex,nofollow');
    echo 'Upstream unavailable';
    if ($error !== '') {
        error_log('GBD STRATO bridge: ' . $error);
    }
    exit;
}

http_response_code($status);
header('Content-Type: ' . $expectedType);

foreach (['cache-control' => 'Cache-Control', 'x-robots-tag' => 'X-Robots-Tag'] as $key => $headerName) {
    if (!empty($responseHeaders[$key])) {
        header($headerName . ': ' . $responseHeaders[$key]);
    }
}

if (!isset($responseHeaders['cache-control'])) {
    header('Cache-Control: no-store');
}

echo $body;
