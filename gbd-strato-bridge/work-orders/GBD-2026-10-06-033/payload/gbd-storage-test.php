<?php
declare(strict_types=1);

/*
 * Games Behind Doors - temporary private staging test gate.
 * Test password is separate from the Maintenance password.
 * It can be created only from an already authenticated Maintenance session.
 * It can later be deleted from an active owner-test session.
 */

header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

const GBD_OWNER_COOKIE = 'GBD_OWNER_TEST';
const GBD_GATE_BEGIN = '# BEGIN GBD OWNER TEST GATE';
const GBD_GATE_END = '# END GBD OWNER TEST GATE';

function h(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function maintenance_data_dir(): string {
    return __DIR__ . '/chatgpt-maintenance/data';
}
function test_auth_file(): string {
    return maintenance_data_dir() . '/owner-test-auth.json';
}
function htaccess_file(): string {
    return __DIR__ . '/.htaccess';
}
function maintenance_authenticated(): bool {
    return !empty($_SESSION['gbd_auth']);
}
function csrf_token(): string {
    if (empty($_SESSION['gbd_owner_test_csrf'])) {
        $_SESSION['gbd_owner_test_csrf'] = bin2hex(random_bytes(32));
    }
    return (string)$_SESSION['gbd_owner_test_csrf'];
}
function verify_csrf(string $token): void {
    $expected = (string)($_SESSION['gbd_owner_test_csrf'] ?? '');
    if ($expected === '' || !hash_equals($expected, $token)) {
        throw new RuntimeException('CSRF-Prüfung fehlgeschlagen.');
    }
}
function client_subject(): string {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $ip);
}
function rate_file(): string {
    return maintenance_data_dir() . '/owner-test-rate/' . client_subject() . '.json';
}
function load_json(string $path): array {
    if (!is_file($path)) return [];
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function atomic_write(string $path, string $bytes, int $mode = 0644): void {
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Ordner konnte nicht angelegt werden.');
    }
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(6));
    if (file_put_contents($tmp, $bytes, LOCK_EX) === false) {
        throw new RuntimeException('Temporäre Datei konnte nicht geschrieben werden.');
    }
    @chmod($tmp, $mode);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Datei konnte nicht atomar ersetzt werden.');
    }
}
function rate_state(): array {
    $state = load_json(rate_file());
    $now = time();
    if ((int)($state['window_start'] ?? 0) < $now - 900) {
        return ['window_start' => $now, 'fails' => 0];
    }
    return [
        'window_start' => (int)($state['window_start'] ?? $now),
        'fails' => (int)($state['fails'] ?? 0),
    ];
}
function can_try(): bool {
    return rate_state()['fails'] < 8;
}
function note_fail(): void {
    $state = rate_state();
    $state['fails']++;
    $dir = dirname(rate_file());
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    atomic_write(rate_file(), json_encode($state, JSON_UNESCAPED_SLASHES), 0600);
}
function clear_fails(): void {
    @unlink(rate_file());
}
function clear_all_rate_files(): void {
    $dir = maintenance_data_dir() . '/owner-test-rate';
    if (!is_dir($dir)) return;
    foreach (glob($dir . '/*.json') ?: [] as $f) {
        if (is_file($f)) @unlink($f);
    }
}
function gbd_host_ok(string $value): bool {
    $value = strtolower(trim($value));
    if ($value === '') return false;
    $host = strtolower((string)parse_url(
        str_contains($value, '://') ? $value : 'https://' . $value,
        PHP_URL_HOST
    ));
    return in_array($host, ['gamesbehinddoors.de', 'www.gamesbehinddoors.de'], true);
}
function same_origin_post(): bool {
    if (!gbd_host_ok((string)($_SERVER['HTTP_HOST'] ?? ''))) return false;

    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && strtolower($origin) !== 'null' && !gbd_host_ok($origin)) return false;

    $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
    if ($referer !== '' && !gbd_host_ok($referer)) return false;

    return true;
}
function remove_gate(string $bytes): string {
    $start = strpos($bytes, GBD_GATE_BEGIN);
    if ($start === false) return ltrim($bytes);
    $end = strpos($bytes, GBD_GATE_END, $start);
    if ($end === false) throw new RuntimeException('Vorhandener Owner-Gate-Marker ist beschädigt.');
    $end += strlen(GBD_GATE_END);
    while (isset($bytes[$end]) && ($bytes[$end] === "\r" || $bytes[$end] === "\n")) $end++;
    return ltrim(substr($bytes, 0, $start) . substr($bytes, $end));
}
function gate_block(string $token): string {
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        throw new RuntimeException('Ungültiger Gate-Token.');
    }
    return GBD_GATE_BEGIN . "\n"
        . "<IfModule mod_rewrite.c>\n"
        . "RewriteEngine On\n"
        . "# Maintenance und Testlogin bleiben erreichbar; alles andere benötigt das private Browser-Cookie.\n"
        . "RewriteRule ^chatgpt-maintenance(?:/|$) - [L]\n"
        . "RewriteRule ^gbd-storage-test\\.php$ - [L]\n"
        . "RewriteRule ^gbd-owner-login\\.html$ - [L]\n"
        . "RewriteCond %{HTTP:Cookie} !(^|;[[:space:]]*)" . GBD_OWNER_COOKIE . "=" . $token . "(;|$) [NC]\n"
        . "RewriteRule ^ - [R=404,L]\n"
        . "</IfModule>\n"
        . GBD_GATE_END . "\n\n";
}
function install_gate(string $token): void {
    $path = htaccess_file();
    if (!is_file($path)) throw new RuntimeException('staging/.htaccess fehlt. Gate wurde nicht installiert.');

    $current = (string)file_get_contents($path);
    $clean = remove_gate($current);
    $next = gate_block($token) . $clean;

    $backupDir = maintenance_data_dir() . '/owner-gate-backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
        throw new RuntimeException('Gate-Backupordner konnte nicht angelegt werden.');
    }
    atomic_write(
        $backupDir . '/htaccess-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.txt',
        $current,
        0600
    );
    $mode = fileperms($path) & 0777;
    atomic_write($path, $next, $mode ?: 0644);
}
function current_token(): ?string {
    $path = htaccess_file();
    if (!is_file($path)) return null;
    $raw = (string)file_get_contents($path);
    if (preg_match('/' . preg_quote(GBD_OWNER_COOKIE, '/') . '=([a-f0-9]{64})/', $raw, $m)) {
        return $m[1];
    }
    return null;
}
function set_owner_cookie(string $token): void {
    setcookie(GBD_OWNER_COOKIE, $token, [
        'expires' => time() + 43200,
        'path' => '/staging/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
function clear_owner_cookie(): void {
    setcookie(GBD_OWNER_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/staging/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
function test_password_is_configured(): bool {
    $auth = load_json(test_auth_file());
    return is_string($auth['password_hash'] ?? null) && (string)$auth['password_hash'] !== '';
}
function save_test_password(string $password): void {
    if (strlen($password) < 8) {
        throw new RuntimeException('Das temporäre Test-Passwort muss mindestens 8 Zeichen lang sein.');
    }
    if (strlen($password) > 512) {
        throw new RuntimeException('Das Passwort ist zu lang.');
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) throw new RuntimeException('Test-Passwort konnte nicht gehasht werden.');

    atomic_write(
        test_auth_file(),
        json_encode([
            'password_hash' => $hash,
            'temporary' => true,
            'created_at' => gmdate('c'),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        0600
    );
    clear_all_rate_files();
}
function verify_test_password(string $password): bool {
    $auth = load_json(test_auth_file());
    $hash = (string)($auth['password_hash'] ?? '');
    return $hash !== '' && password_verify($password, $hash);
}
function delete_test_credentials(): void {
    @unlink(test_auth_file());
    clear_all_rate_files();
    $newToken = bin2hex(random_bytes(32));
    install_gate($newToken);
    clear_owner_cookie();
}

$error = null;
$success = null;

try {
    if (!gbd_host_ok((string)($_SERVER['HTTP_HOST'] ?? ''))) {
        http_response_code(404);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!same_origin_post()) {
            throw new RuntimeException('Ungültige Anfragequelle.');
        }

        $action = (string)($_POST['action'] ?? 'login');

        if ($action === 'setup_test_password' || $action === 'change_test_password') {
            if (!maintenance_authenticated()) {
                throw new RuntimeException('Test-Passwort darf nur aus einer angemeldeten Maintenance-Sitzung gesetzt werden.');
            }
            verify_csrf((string)($_POST['csrf'] ?? ''));

            $password = (string)($_POST['password'] ?? '');
            $confirm = (string)($_POST['password_confirm'] ?? '');
            if (!hash_equals($password, $confirm)) {
                throw new RuntimeException('Die beiden Passwort-Eingaben stimmen nicht überein.');
            }

            save_test_password($password);
            $success = 'Temporäres Test-Passwort wurde gesetzt. Es wird nur als sicherer Hash gespeichert.';
        } elseif ($action === 'login') {
            if (!test_password_is_configured()) {
                throw new RuntimeException('Es ist noch kein temporäres Test-Passwort eingerichtet.');
            }
            if (!can_try()) {
                throw new RuntimeException('Zu viele Fehlversuche. 15 Minuten warten.');
            }

            $password = (string)($_POST['password'] ?? '');
            if (!verify_test_password($password)) {
                note_fail();
                throw new RuntimeException('Anmeldung fehlgeschlagen.');
            }

            clear_fails();
            $token = bin2hex(random_bytes(32));
            install_gate($token);
            set_owner_cookie($token);

            header('Location: /staging/', true, 303);
            exit;
        } elseif ($action === 'logout') {
            $token = bin2hex(random_bytes(32));
            install_gate($token);
            clear_owner_cookie();
            $success = 'Privater Testzugang wurde für diesen Browser widerrufen.';
        } elseif ($action === 'cleanup_test_access') {
            $token = current_token();
            $cookie = (string)($_COOKIE[GBD_OWNER_COOKIE] ?? '');
            $active = $token !== null && $cookie !== '' && hash_equals($token, $cookie);

            if (!$active && !maintenance_authenticated()) {
                throw new RuntimeException('Zum Löschen des Testzugangs ist eine aktive Owner-Test- oder Maintenance-Sitzung erforderlich.');
            }
            verify_csrf((string)($_POST['csrf'] ?? ''));

            delete_test_credentials();
            $success = 'Temporäres Test-Passwort und Owner-Testzugang wurden gelöscht. Staging ist wieder für alle mit 404 gesperrt.';
        } else {
            throw new RuntimeException('Unbekannte Aktion.');
        }
    }
} catch (Throwable $e) {
    $error = $e->getMessage();
}

$token = current_token();
$cookie = (string)($_COOKIE[GBD_OWNER_COOKIE] ?? '');
$active = $token !== null && $cookie !== '' && hash_equals($token, $cookie);
$configured = test_password_is_configured();
$maintenance = maintenance_authenticated();
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>GBD Privater Testzugang</title>
<style>
:root{color-scheme:dark;font:16px/1.5 system-ui;background:#0f1115;color:#eef2f7}
body{margin:0}
main{max-width:620px;margin:6vh auto;padding:24px}
.card{background:#181c23;border:1px solid #303744;border-radius:16px;padding:22px}
h1,h2{margin-top:0}
p{color:#b9c1ce}
label.field-label{display:block;margin:16px 0 8px}
input[type="password"],input[type="text"]{box-sizing:border-box;width:100%;padding:12px;border-radius:9px;border:1px solid #465064;background:#0d1117;color:white}
.show-password{display:flex;align-items:center;gap:9px;margin:12px 0 0;color:#dce5f2;cursor:pointer;user-select:none}
.show-password input{width:20px;height:20px;margin:0}
button,a.btn{margin-top:14px;border:0;border-radius:9px;padding:11px 15px;font-weight:700;background:#edf2f7;color:#111827;text-decoration:none;display:inline-block;cursor:pointer}
.secondary{background:#343c49!important;color:white!important}
.danger{background:#7f1d1d!important;color:white!important}
.ok{padding:12px;border-radius:10px;background:#15301f;color:#bdf4cd}
.err{padding:12px;border-radius:10px;background:#35191d;color:#ffc7ce}
.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#243040;color:#dce5f2;margin-bottom:14px}
hr{border:0;border-top:1px solid #303744;margin:24px 0}
small{color:#9aa5b5}
</style>
</head>
<body>
<main>
<div class="card">
<span class="badge">GBD • TEMPORÄRER OWNER-TEST</span>
<h1>Privater Staging-Testzugang</h1>
<p>Dieses Passwort ist ausschließlich für den privaten Staging-Test. Es ist getrennt vom Maintenance-Passwort und wird nur als Hash gespeichert.</p>

<?php if ($error): ?><div class="err"><?=h($error)?></div><?php endif; ?>
<?php if ($success): ?><div class="ok"><?=h($success)?></div><?php endif; ?>

<?php if ($maintenance): ?>
<hr>
<h2><?= $configured ? 'Test-Passwort ändern' : 'Test-Passwort selbst festlegen' ?></h2>
<p>Du bist über die Maintenance-Sitzung autorisiert. Das hier gesetzte Passwort ist temporär und kann nach dem Test vollständig gelöscht werden.</p>
<form method="post" autocomplete="off">
<input type="hidden" name="action" value="<?= $configured ? 'change_test_password' : 'setup_test_password' ?>">
<input type="hidden" name="csrf" value="<?=h(csrf_token())?>">
<label class="field-label" for="newPassword">Neues Test-Passwort</label>
<input id="newPassword" name="password" type="password" required minlength="8" maxlength="512" autocomplete="new-password" spellcheck="false" autocapitalize="none">
<label class="field-label" for="newPassword2">Test-Passwort wiederholen</label>
<input id="newPassword2" name="password_confirm" type="password" required minlength="8" maxlength="512" autocomplete="new-password" spellcheck="false" autocapitalize="none">
<label class="show-password" for="showNewPassword">
<input id="showNewPassword" type="checkbox" autocomplete="off">
<span>Passwörter anzeigen</span>
</label>
<button type="submit"><?= $configured ? 'TEST-PASSWORT ÄNDERN' : 'TEST-PASSWORT FESTLEGEN' ?></button>
</form>
<?php endif; ?>

<?php if ($configured && !$active): ?>
<hr>
<h2>Testzugang öffnen</h2>
<form method="post" autocomplete="off">
<input type="hidden" name="action" value="login">
<label class="field-label" for="password">Temporäres Test-Passwort</label>
<input id="password" name="password" type="password" required maxlength="512" autocomplete="current-password" spellcheck="false" autocapitalize="none">
<label class="show-password" for="showPassword">
<input id="showPassword" type="checkbox" autocomplete="off">
<span>Passwort anzeigen</span>
</label>
<button type="submit">PRIVATEN TESTZUGANG AKTIVIEREN</button>
</form>
<?php elseif (!$configured && !$maintenance): ?>
<div class="err">Das temporäre Test-Passwort wurde noch nicht eingerichtet. Die Einrichtung ist ausschließlich aus einer bereits angemeldeten Maintenance-Sitzung möglich.</div>
<?php endif; ?>

<?php if ($active): ?>
<hr>
<div class="ok">Dieser Browser hat aktuell privaten Staging-Testzugang.</div>
<a class="btn" href="/staging/">STAGING ÖFFNEN</a>
<form method="post">
<input type="hidden" name="action" value="logout">
<button class="secondary" type="submit">NUR DIESEN BROWSER ABMELDEN</button>
</form>
<?php endif; ?>

<?php if ($configured && ($active || $maintenance)): ?>
<hr>
<h2>Nach dem Test aufräumen</h2>
<p>Diese Funktion löscht den temporären Passwort-Hash, widerruft den Owner-Testzugang und sperrt Staging wieder mit HTTP 404.</p>
<form method="post" onsubmit="return confirm('Temporäres Test-Passwort und privaten Testzugang wirklich löschen?');">
<input type="hidden" name="action" value="cleanup_test_access">
<input type="hidden" name="csrf" value="<?=h(csrf_token())?>">
<button class="danger" type="submit">TEST-PASSWORT + TESTZUGANG LÖSCHEN</button>
</form>
<p><small>Website-Testkonten, die während der Funktionsprüfung angelegt werden, werden separat als Testkonten behandelt und nach Abschluss der Tests gelöscht. Diese Schaltfläche löscht keine normalen Benutzerkonten.</small></p>
<?php endif; ?>

<p><small>0/3, PayPal-LIVE, Echtgeld und die öffentliche Plattform werden hierdurch nicht aktiviert.</small></p>
</div>
</main>
<script>
(function(){
  function bind(toggleId, inputIds){
    const toggle=document.getElementById(toggleId);
    if(!toggle)return;
    toggle.addEventListener('change',function(){
      inputIds.forEach(function(id){
        const input=document.getElementById(id);
        if(input) input.type=toggle.checked?'text':'password';
      });
    });
  }
  bind('showPassword',['password']);
  bind('showNewPassword',['newPassword','newPassword2']);
})();
</script>
</body>
</html>
