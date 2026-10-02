<?php
declare(strict_types=1);

/*
 * Games Behind Doors STRATO bridge.
 * - Public HTML/XML proxy for fixed public Edge Functions.
 * - Same-origin service proxy for security-sensitive EU-only actions.
 * - Country signal is derived server-side from REMOTE_ADDR using a local RIPE
 *   registry cache. No raw client IP is forwarded to Supabase or stored here.
 * - No arbitrary upstream URLs are accepted.
 */

const EDGE_BASE = 'https://voldtqsdqcdexkexwerp.supabase.co/functions/v1/';
const GBD_ALLOWED_ORIGIN = 'https://gamesbehinddoors.de';
const GBD_GEO_CACHE = '/home/www/gamesbehinddoors-secrets/ripe-country-ranges-v1.json';
const GBD_GEO_SOURCE = 'https://ftp.ripe.net/ripe/stats/delegated-ripencc-latest';
const GBD_GEO_REFRESH_SECONDS = 604800; // 7 days
const GBD_GEO_MAX_STALE_SECONDS = 2592000; // 30 days

function out_text(int $status, string $text): never {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $text;
    exit;
}

function out_json(int $status, array $data): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function bridge_secret(): string {
    $secret = trim((string)getenv('GBD_STORAGE_HMAC_SECRET'));
    if ($secret === '') {
        $privateConfig = '/home/www/gamesbehinddoors-secrets/storage-gateway.php';
        if (is_file($privateConfig)) {
            $config = require $privateConfig;
            if (is_array($config)) {
                $secret = trim((string)($config['hmac_secret'] ?? ''));
            }
        }
    }
    if ($secret === '') out_json(503, ['ok'=>false,'error'=>'proxy_not_configured']);
    return $secret;
}

function client_ip(): ?string {
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    if ($ip === '' || filter_var($ip, FILTER_VALIDATE_IP) === false) return null;
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return null;
    return $ip;
}

function v4num(string $ip): ?int {
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) return null;
    $n = ip2long($ip);
    if ($n === false) return null;
    if ($n < 0) $n += 4294967296;
    return (int)$n;
}

function ipv6_prefix_match(string $ip, string $network, int $prefix): bool {
    $a = @inet_pton($ip);
    $b = @inet_pton($network);
    if ($a === false || $b === false || strlen($a) !== 16 || strlen($b) !== 16) return false;
    $full = intdiv($prefix, 8);
    $rest = $prefix % 8;
    if ($full > 0 && substr($a, 0, $full) !== substr($b, 0, $full)) return false;
    if ($rest === 0) return true;
    $mask = (0xff << (8 - $rest)) & 0xff;
    return ((ord($a[$full]) & $mask) === (ord($b[$full]) & $mask));
}

function download_ripe_registry(): ?string {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init(GBD_GEO_SOURCE);
    if ($ch === false) return null;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'GamesBehindDoors-CountryCache/1.0',
        CURLOPT_HTTPHEADER => ['Accept: text/plain'],
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (!is_string($body) || $status !== 200 || strlen($body) < 100000 || strlen($body) > 20000000) return null;
    return $body;
}

function refresh_country_cache(): bool {
    $dir = dirname(GBD_GEO_CACHE);
    if (!is_dir($dir)) return false;

    $lockPath = $dir . '/ripe-country-ranges-v1.lock';
    $lock = @fopen($lockPath, 'c');
    if ($lock === false) return false;
    if (!flock($lock, LOCK_EX)) { fclose($lock); return false; }

    clearstatcache(true, GBD_GEO_CACHE);
    if (is_file(GBD_GEO_CACHE) && (time() - (int)filemtime(GBD_GEO_CACHE)) < GBD_GEO_REFRESH_SECONDS) {
        flock($lock, LOCK_UN); fclose($lock); return true;
    }

    $raw = download_ripe_registry();
    if ($raw === null) {
        flock($lock, LOCK_UN); fclose($lock); return false;
    }

    $v4 = [];
    $v6 = [];
    foreach (preg_split('/\r?\n/', $raw) as $line) {
        if ($line === '' || str_starts_with($line, '#')) continue;
        $p = explode('|', $line);
        if (count($p) < 7 || strtolower($p[0]) !== 'ripencc') continue;
        $cc = strtoupper(trim($p[1]));
        $type = strtolower(trim($p[2]));
        $start = trim($p[3]);
        $value = trim($p[4]);
        $status = strtolower(trim($p[6]));
        if (!preg_match('/^[A-Z]{2}$/', $cc)) continue;
        if (!in_array($status, ['allocated','assigned','legacy'], true)) continue;

        if ($type === 'ipv4') {
            $startNum = v4num($start);
            $count = ctype_digit($value) ? (int)$value : 0;
            if ($startNum === null || $count <= 0) continue;
            $endNum = min(4294967295, $startNum + $count - 1);
            $octet = (int)explode('.', $start, 2)[0];
            $v4[(string)$octet][] = [$startNum, $endNum, $cc];
        } elseif ($type === 'ipv6') {
            $prefix = ctype_digit($value) ? (int)$value : -1;
            $packed = @inet_pton($start);
            if ($packed === false || $prefix < 0 || $prefix > 128) continue;
            $norm = inet_ntop($packed);
            if (!is_string($norm)) continue;
            $bucket = bin2hex(substr($packed, 0, 1));
            $v6[$bucket][] = [$norm, $prefix, $cc];
        }
    }

    foreach ($v4 as &$entries) {
        usort($entries, static fn(array $a, array $b): int => $a[0] <=> $b[0]);
    }
    unset($entries);

    $payload = json_encode([
        'generated_at' => gmdate('c'),
        'source' => 'RIPE delegated-ripencc-latest',
        'ipv4' => $v4,
        'ipv6' => $v6,
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($payload) || strlen($payload) < 1000) {
        flock($lock, LOCK_UN); fclose($lock); return false;
    }

    $tmp = GBD_GEO_CACHE . '.tmp-' . bin2hex(random_bytes(6));
    $ok = file_put_contents($tmp, $payload, LOCK_EX) !== false;
    if ($ok) {
        @chmod($tmp, 0600);
        $ok = @rename($tmp, GBD_GEO_CACHE);
    }
    if (!$ok) @unlink($tmp);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok;
}

function load_country_cache(): ?array {
    clearstatcache(true, GBD_GEO_CACHE);
    $exists = is_file(GBD_GEO_CACHE);
    $age = $exists ? time() - (int)filemtime(GBD_GEO_CACHE) : PHP_INT_MAX;
    if (!$exists || $age > GBD_GEO_REFRESH_SECONDS) {
        refresh_country_cache();
        clearstatcache(true, GBD_GEO_CACHE);
        $exists = is_file(GBD_GEO_CACHE);
        $age = $exists ? time() - (int)filemtime(GBD_GEO_CACHE) : PHP_INT_MAX;
    }
    if (!$exists || $age > GBD_GEO_MAX_STALE_SECONDS) return null;
    $raw = @file_get_contents(GBD_GEO_CACHE);
    if (!is_string($raw) || $raw === '') return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function country_for_ip(?string $ip): ?string {
    if ($ip === null) return null;
    $cache = load_country_cache();
    if (!is_array($cache)) return null;

    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $n = v4num($ip);
        if ($n === null) return null;
        $octet = (string)((int)explode('.', $ip, 2)[0]);
        foreach (($cache['ipv4'][$octet] ?? []) as $r) {
            if (!is_array($r) || count($r) < 3) continue;
            if ($n >= (int)$r[0] && $n <= (int)$r[1]) return (string)$r[2];
        }
        return null;
    }

    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $packed = @inet_pton($ip);
        if ($packed === false) return null;
        $bucket = bin2hex(substr($packed, 0, 1));
        foreach (($cache['ipv6'][$bucket] ?? []) as $r) {
            if (!is_array($r) || count($r) < 3) continue;
            if (ipv6_prefix_match($ip, (string)$r[0], (int)$r[1])) return (string)$r[2];
        }
    }
    return null;
}

function incoming_headers_lower(): array {
    $result = [];
    if (function_exists('getallheaders')) {
        foreach ((array)getallheaders() as $k => $v) $result[strtolower((string)$k)] = (string)$v;
    }
    if (!isset($result['authorization']) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $result['authorization'] = (string)$_SERVER['HTTP_AUTHORIZATION'];
    }
    return $result;
}

function proxy_sensitive_service(string $service): never {
    $map = [
        'country_check' => ['gbd-country-check','country_check'],
        'developer_signup' => ['gbd-developer-signup','developer_signup'],
        'player_signup' => ['gbd-player-signup','player_signup'],
        'prepare_submission' => ['gbd-prepare-submission','prepare_submission'],
        'paypal_marketplace' => ['gbd-paypal-marketplace','paypal_marketplace'],
        'paypal_checkout' => ['gbd-paypal-checkout','paypal_checkout'],
        'commercial_verification' => ['gbd-commercial-verification','commercial_verification'],
        'game_download' => ['gbd-game-download','game_download'],
    ];
    if (!isset($map[$service])) out_json(404, ['ok'=>false,'error'=>'service_not_found']);

    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && $origin !== GBD_ALLOWED_ORIGIN) out_json(403, ['ok'=>false,'error'=>'origin_blocked']);

    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET','POST'], true)) out_json(405, ['ok'=>false,'error'=>'method_not_allowed']);

    $raw = file_get_contents('php://input');
    if (!is_string($raw)) $raw = '';
    if (strlen($raw) > 2097152) out_json(413, ['ok'=>false,'error'=>'request_too_large']);

    $ip = client_ip();
    $country = country_for_ip($ip) ?? 'ZZ';
    $ts = (string)time();
    $nonce = bin2hex(random_bytes(16));
    [$edge, $action] = $map[$service];
    $secret = bridge_secret();
    $canonical = "country-v1\n{$country}\n{$ts}\n{$nonce}\n{$action}";
    $signature = hash_hmac('sha256', $canonical, $secret);
    $subject = hash_hmac('sha256', "abuse-v1\n" . ($ip ?? 'unknown'), $secret);

    $incoming = incoming_headers_lower();
    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
        'Origin: ' . GBD_ALLOWED_ORIGIN,
        'X-GBD-Trusted-Country-Code: ' . $country,
        'X-GBD-Trusted-Country-Timestamp: ' . $ts,
        'X-GBD-Trusted-Country-Nonce: ' . $nonce,
        'X-GBD-Trusted-Country-Signature: ' . $signature,
        'X-GBD-Trusted-Country-Action: ' . $action,
        'X-GBD-Proxy-Subject: ' . $subject,
    ];
    foreach (['authorization'=>'Authorization','apikey'=>'apikey','x-client-info'=>'x-client-info'] as $lower=>$name) {
        if (!empty($incoming[$lower]) && strlen($incoming[$lower]) < 8192) $headers[] = $name . ': ' . $incoming[$lower];
    }

    $ch = curl_init(EDGE_BASE . $edge);
    if ($ch === false) out_json(502, ['ok'=>false,'error'=>'upstream_unavailable']);
    $responseHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $method === 'POST' ? $raw : null,
        CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
            $length = strlen($header);
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            return $length;
        },
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if (!is_string($body) || $status < 100) {
        if ($error !== '') error_log('GBD sensitive proxy: ' . $error);
        out_json(502, ['ok'=>false,'error'=>'upstream_unavailable']);
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if (!empty($responseHeaders['retry-after'])) header('Retry-After: ' . $responseHeaders['retry-after']);
    echo $body;
    exit;
}

$service = isset($_GET['service']) ? strtolower(trim((string)$_GET['service'])) : '';
if ($service !== '') {
    proxy_sensitive_service($service);
}

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
    out_text(404, 'Not found');
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
if ($ch === false) out_text(502, 'Upstream unavailable');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_USERAGENT => 'GamesBehindDoors-STRATO-Bridge/2.0',
    CURLOPT_HTTPHEADER => ['Accept: ' . ($route === 'sitemap' ? 'application/xml' : 'text/html')],
    CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
        $length = strlen($header);
        $parts = explode(':', $header, 2);
        if (count($parts) === 2) $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
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
    if ($error !== '') error_log('GBD STRATO bridge: ' . $error);
    exit;
}

http_response_code($status);
header('Content-Type: ' . $expectedType);
foreach (['cache-control' => 'Cache-Control', 'x-robots-tag' => 'X-Robots-Tag'] as $key => $headerName) {
    if (!empty($responseHeaders[$key])) header($headerName . ': ' . $responseHeaders[$key]);
}
if (!isset($responseHeaders['cache-control'])) header('Cache-Control: no-store');
echo $body;
