<?php
declare(strict_types=1);

/*
 * Games Behind Doors - private staging bootstrap
 * Work Order GBD-2026-10-06-038
 *
 * The private link carries its bearer token in the URL fragment (#...).
 * Fragments are never sent in the HTTP request. Browser JavaScript posts the
 * token to this endpoint, the server compares only its SHA-256 hash, installs
 * a fail-closed staging gate and returns a Secure/HttpOnly cookie.
 */

const GBD_OWNER_COOKIE = 'GBD_OWNER_TEST';
const GBD_LINK_TOKEN_SHA256 = 'd5860e10d14d35fe5177dc722731964e00a5129b33b1bff0e2d26738185fa5f4';
const GBD_GATE_BEGIN = '# BEGIN GBD OWNER TEST GATE';
const GBD_GATE_END   = '# END GBD OWNER TEST GATE';

function gbd_security_headers(): void {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet', true);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()');
    header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}

function gbd_fail_404(string $kind = 'html'): never {
    http_response_code(404);
    if ($kind === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'not_found'], JSON_UNESCAPED_SLASHES);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
    }
    exit;
}

function gbd_host_ok(): bool {
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\\d+$/', '', $host) ?? $host;
    return $host === 'gamesbehinddoors.de' || $host === 'www.gamesbehinddoors.de';
}

function gbd_origin_ok(): bool {
    $origin = strtolower(trim((string)($_SERVER['HTTP_ORIGIN'] ?? '')));
    return $origin === 'https://gamesbehinddoors.de' || $origin === 'https://www.gamesbehinddoors.de';
}

function gbd_install_gate(string $gateToken): void {
    $stagingRoot = __DIR__;
    $htaccess = $stagingRoot . '/.htaccess';
    $dataDir = $stagingRoot . '/chatgpt-maintenance/data';

    if (!is_dir($dataDir) && !@mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
        throw new RuntimeException('maintenance_data_unavailable');
    }

    $lockPath = $dataDir . '/owner-link-gate.lock';
    $lock = @fopen($lockPath, 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        throw new RuntimeException('gate_lock_failed');
    }

    try {
        $current = is_file($htaccess) ? (string)@file_get_contents($htaccess) : '';
        if (is_file($htaccess) && $current === '') {
            throw new RuntimeException('htaccess_read_failed');
        }

        $hasBegin = str_contains($current, GBD_GATE_BEGIN);
        $hasEnd = str_contains($current, GBD_GATE_END);
        if ($hasBegin xor $hasEnd) {
            throw new RuntimeException('gate_marker_mismatch');
        }

        $backup = $dataDir . '/staging-htaccess-before-private-link-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.bak';
        if (@file_put_contents($backup, $current, LOCK_EX) === false) {
            throw new RuntimeException('backup_failed');
        }
        @chmod($backup, 0600);

        if ($hasBegin && $hasEnd) {
            $pattern = '~\\R?' . preg_quote(GBD_GATE_BEGIN, '~') . '.*?' . preg_quote(GBD_GATE_END, '~') . '\\R?~s';
            $base = preg_replace($pattern, "\n", $current, 1);
            if ($base === null) throw new RuntimeException('gate_replace_failed');
        } else {
            $base = $current;
        }

        $gate = "\n" . GBD_GATE_BEGIN . "\n"
              . "<IfModule mod_rewrite.c>\n"
              . "RewriteEngine On\n"
              . "RewriteCond %{REQUEST_URI} !^/staging/chatgpt-maintenance(?:/|$) [NC]\n"
              . "RewriteCond %{REQUEST_URI} !^/staging/gbd-storage-test\\.php$ [NC]\n"
              . "RewriteCond %{REQUEST_URI} !^/staging/gbd-owner-login\\.html$ [NC]\n"
              . "RewriteCond %{HTTP:Cookie} !(^|;[[:space:]]*)" . GBD_OWNER_COOKIE . "=" . $gateToken . "(;|$) [NC]\n"
              . "RewriteRule ^ - [R=404,L]\n"
              . "</IfModule>\n"
              . "<IfModule mod_headers.c>\n"
              . "Header always set X-Robots-Tag \"noindex, nofollow, noarchive, nosnippet\"\n"
              . "Header always set Cache-Control \"no-store\"\n"
              . "</IfModule>\n"
              . GBD_GATE_END . "\n";

        $next = rtrim((string)$base) . "\n" . $gate;
        if (@file_put_contents($htaccess, $next, LOCK_EX) === false) {
            throw new RuntimeException('htaccess_write_failed');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @chmod($lockPath, 0600);
    }
}

gbd_security_headers();
if (!gbd_host_ok()) gbd_fail_404();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'POST') {
    if (!gbd_origin_ok()) gbd_fail_404('json');
    if ((string)($_SERVER['HTTP_X_GBD_PRIVATE_BOOTSTRAP'] ?? '') !== '1') gbd_fail_404('json');
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_starts_with($contentType, 'application/json')) gbd_fail_404('json');

    $raw = (string)file_get_contents('php://input');
    if (strlen($raw) > 2048) gbd_fail_404('json');
    $body = json_decode($raw, true);
    $provided = is_array($body) ? (string)($body['token'] ?? '') : '';

    if ($provided === '' || strlen($provided) > 256) gbd_fail_404('json');
    $providedHash = hash('sha256', $provided);
    if (!hash_equals(GBD_LINK_TOKEN_SHA256, $providedHash)) gbd_fail_404('json');

    try {
        $gateToken = bin2hex(random_bytes(32));
        gbd_install_gate($gateToken);
        setcookie(GBD_OWNER_COOKIE, $gateToken, [
            'expires' => time() + 43200,
            'path' => '/staging/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'redirect' => '/staging/'], JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        error_log('GBD private staging bootstrap failed: ' . $e->getMessage());
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'private_access_unavailable'], JSON_UNESCAPED_SLASHES);
        exit;
    }
}

if ($method !== 'GET') gbd_fail_404();

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 Not Found</title>
<style>body{font-family:system-ui,sans-serif;margin:3rem;line-height:1.45}#m{display:none}</style>
</head>
<body>
<h1>Not Found</h1>
<p id="p">The requested URL was not found on this server.</p>
<p id="m">Privater Testzugang wird geöffnet…</p>
<script>
(() => {
  const token = location.hash.length > 1 ? location.hash.slice(1) : '';
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) return;
  history.replaceState(null, '', location.pathname);
  document.getElementById('p').style.display = 'none';
  document.getElementById('m').style.display = 'block';
  fetch(location.pathname, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {'Content-Type':'application/json','X-GBD-Private-Bootstrap':'1'},
    body: JSON.stringify({token})
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok !== true) throw new Error('denied');
    location.replace(d.redirect || '/staging/');
  }).catch(() => {
    document.getElementById('m').style.display = 'none';
    document.getElementById('p').style.display = 'block';
  });
})();
</script>
</body>
</html>
