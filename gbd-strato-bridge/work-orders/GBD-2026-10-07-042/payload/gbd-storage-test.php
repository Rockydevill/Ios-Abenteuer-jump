<?php
declare(strict_types=1);

/*
 * Games Behind Doors private staging bootstrap.
 * Private direct-link access only. No public release, no payment changes.
 */
const GBD_OWNER_COOKIE = 'GBD_OWNER_TEST';
const GBD_LINK_TOKEN_SHA256 = 'cdfe5542bcdd823beaa165c8bf00684434a78fd200f629b13784931f85dd49d7';
const GBD_GATE_BEGIN = '# BEGIN GBD OWNER TEST GATE';
const GBD_GATE_END = '# END GBD OWNER TEST GATE';

function sec_headers(): void {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet', true);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}

function not_found(string $kind = 'html'): never {
    http_response_code(404);
    if ($kind === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        echo '{"error":"not_found"}';
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';
    }
    exit;
}

function host_ok(): bool {
    $h = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $h = preg_replace('/:\d+$/', '', $h) ?? $h;
    return $h === 'gamesbehinddoors.de' || $h === 'www.gamesbehinddoors.de';
}

function origin_ok(): bool {
    $o = strtolower(trim((string)($_SERVER['HTTP_ORIGIN'] ?? '')));
    return $o === 'https://gamesbehinddoors.de' || $o === 'https://www.gamesbehinddoors.de';
}

function gate_install(string $gateToken): void {
    $root = __DIR__;
    $ht = $root . '/.htaccess';
    $data = $root . '/chatgpt-maintenance/data';

    if (!is_dir($data) && !@mkdir($data, 0700, true) && !is_dir($data)) {
        throw new RuntimeException('maintenance_data_unavailable');
    }

    $lockPath = $data . '/owner-link-gate.lock';
    $lock = @fopen($lockPath, 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        throw new RuntimeException('gate_lock_failed');
    }

    try {
        $cur = is_file($ht) ? (string)@file_get_contents($ht) : '';
        if (is_file($ht) && $cur === '') throw new RuntimeException('htaccess_read_failed');

        $hasBegin = str_contains($cur, GBD_GATE_BEGIN);
        $hasEnd = str_contains($cur, GBD_GATE_END);
        if ($hasBegin xor $hasEnd) throw new RuntimeException('gate_marker_mismatch');

        $bak = $data . '/staging-htaccess-before-private-link-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.bak';
        if (@file_put_contents($bak, $cur, LOCK_EX) === false) throw new RuntimeException('backup_failed');
        @chmod($bak, 0600);

        if ($hasBegin && $hasEnd) {
            $pattern = '~\R?' . preg_quote(GBD_GATE_BEGIN, '~') . '.*?' . preg_quote(GBD_GATE_END, '~') . '\R?~s';
            $base = preg_replace($pattern, "\n", $cur, 1);
            if ($base === null) throw new RuntimeException('gate_replace_failed');
        } else {
            $base = $cur;
        }

        $gate = "\n" . GBD_GATE_BEGIN . "\n"
            . "<IfModule mod_rewrite.c>\n"
            . "RewriteEngine On\n"
            . "RewriteCond %{REQUEST_URI} !^/staging/chatgpt-maintenance(?:/|$) [NC]\n"
            . "RewriteCond %{REQUEST_URI} !^/staging/gbd-storage-test\\.php$ [NC]\n"
            . "RewriteCond %{HTTP:Cookie} !(^|;[[:space:]]*)" . GBD_OWNER_COOKIE . "=" . $gateToken . "(;|$) [NC]\n"
            . "RewriteRule ^ - [R=404,L]\n"
            . "</IfModule>\n"
            . "<IfModule mod_headers.c>\n"
            . "Header always set X-Robots-Tag \"noindex, nofollow, noarchive, nosnippet\"\n"
            . "Header always set Cache-Control \"no-store\"\n"
            . "</IfModule>\n"
            . GBD_GATE_END . "\n";

        $next = rtrim((string)$base) . "\n" . $gate;
        if (@file_put_contents($ht, $next, LOCK_EX) === false) throw new RuntimeException('htaccess_write_failed');
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @chmod($lockPath, 0600);
    }
}

sec_headers();
if (!host_ok()) not_found();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'POST') {
    if (!origin_ok()) not_found('json');
    if ((string)($_SERVER['HTTP_X_GBD_PRIVATE_BOOTSTRAP'] ?? '') !== '1') not_found('json');

    $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_starts_with($ct, 'application/json')) not_found('json');

    $raw = (string)file_get_contents('php://input');
    if (strlen($raw) > 2048) not_found('json');

    $body = json_decode($raw, true);
    $provided = is_array($body) ? (string)($body['token'] ?? '') : '';
    if ($provided === '' || strlen($provided) > 256) not_found('json');
    if (!hash_equals(GBD_LINK_TOKEN_SHA256, hash('sha256', $provided))) not_found('json');

    try {
        $gateToken = bin2hex(random_bytes(32));
        gate_install($gateToken);

        setcookie(GBD_OWNER_COOKIE, $gateToken, [
            'expires' => time() + 43200,
            'path' => '/staging/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);

        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => true,
            'redirect' => '/staging/'
        ], JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        error_log('GBD private bootstrap failed: ' . $e->getMessage());
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"error":"private_access_unavailable"}';
        exit;
    }
}

if ($method !== 'GET') not_found();

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
<style>
body{font-family:system-ui,sans-serif;margin:3rem;line-height:1.45}
#opening{display:none}
</style>
</head>
<body>
<h1>Not Found</h1>
<p id="normal">The requested URL was not found on this server.</p>
<p id="opening">Privater Testzugang wird geöffnet…</p>
<script>
(()=>{
  const token = location.hash.length > 1 ? location.hash.slice(1) : '';
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) return;

  history.replaceState(null, '', location.pathname);
  document.getElementById('normal').style.display = 'none';
  document.getElementById('opening').style.display = 'block';

  fetch(location.pathname, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-GBD-Private-Bootstrap': '1'
    },
    body: JSON.stringify({token})
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok !== true) throw new Error('private_access_failed');
    location.replace(d.redirect || '/staging/');
  }).catch(() => {
    document.getElementById('opening').style.display = 'none';
    document.getElementById('normal').style.display = 'block';
  });
})();
</script>
</body>
</html>
