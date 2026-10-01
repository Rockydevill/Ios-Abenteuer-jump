<?php
declare(strict_types=1);

/*
 * Games Behind Doors private STRATO storage gateway.
 * Production secrets are loaded from the server environment and are never
 * committed to GitHub or returned to clients.
 */

const GBD_ROOT = '/home/www/gamesbehinddoors-storage';
const GBD_MAX = 314572800; // 300 MiB
const GBD_SKEW = 300;
const GBD_ALLOWED_ORIGIN = 'https://gamesbehinddoors.de';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: '.GBD_ALLOWED_ORIGIN);
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET,HEAD,PUT,POST,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,Content-Length,Range,X-GBD-Timestamp,X-GBD-Nonce,X-GBD-Signature,X-GBD-SHA256');
header('Access-Control-Expose-Headers: Content-Length,Content-Range,Accept-Ranges,X-GBD-SHA256');

function j(int $status, array $data): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo json_encode($data, JSON_UNESCAPED_SLASHES);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function secret_value(): string {
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
    if ($secret === '') j(503, ['ok'=>false,'error'=>'gateway_not_configured']);
    return $secret;
}

function safe_key(string $key): string {
    $key = ltrim(str_replace('\\', '/', $key), '/');
    if (
        $key === '' ||
        strlen($key) > 500 ||
        str_contains($key, '..') ||
        str_starts_with($key, '.gateway-nonces/') ||
        !preg_match('#^[A-Za-z0-9._/-]+$#', $key)
    ) {
        j(400, ['ok'=>false,'error'=>'invalid_key']);
    }
    return $key;
}

function root_path(): string {
    $root = realpath(GBD_ROOT);
    if ($root === false || !is_dir($root)) j(503, ['ok'=>false,'error'=>'storage_unavailable']);
    return rtrim($root, '/');
}

function read_path(string $key): string {
    return root_path().'/'.safe_key($key);
}

function write_path(string $key): string {
    $root = root_path();
    $path = $root.'/'.safe_key($key);
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) j(500, ['ok'=>false,'error'=>'mkdir_failed']);
    $real = realpath($dir);
    if ($real === false || !str_starts_with($real.'/', $root.'/')) j(403, ['ok'=>false,'error'=>'path_blocked']);
    return $path;
}

function authorize_request(string $method, string $key): void {
    $ts = (string)($_SERVER['HTTP_X_GBD_TIMESTAMP'] ?? ($_GET['ts'] ?? ''));
    $nonce = (string)($_SERVER['HTTP_X_GBD_NONCE'] ?? ($_GET['nonce'] ?? ''));
    $sig = strtolower((string)($_SERVER['HTTP_X_GBD_SIGNATURE'] ?? ($_GET['sig'] ?? '')));

    if (!ctype_digit($ts) || abs(time() - (int)$ts) > GBD_SKEW) {
        j(401, ['ok'=>false,'error'=>'expired']);
    }
    if (!preg_match('/^[A-Za-z0-9_-]{16,128}$/', $nonce)) {
        j(401, ['ok'=>false,'error'=>'bad_nonce']);
    }
    if (!preg_match('/^[a-f0-9]{64}$/', $sig)) {
        j(401, ['ok'=>false,'error'=>'bad_signature']);
    }

    $canonical = strtoupper($method)."\n".safe_key($key)."\n".$ts."\n".$nonce;
    $expected = hash_hmac('sha256', $canonical, secret_value());
    if (!hash_equals($expected, $sig)) j(401, ['ok'=>false,'error'=>'bad_signature']);

    $nonceDir = root_path().'/.gateway-nonces';
    if (!is_dir($nonceDir) && !@mkdir($nonceDir, 0750, true)) {
        j(500, ['ok'=>false,'error'=>'nonce_store_failed']);
    }

    $nonceFile = $nonceDir.'/'.hash('sha256', $nonce);
    $handle = @fopen($nonceFile, 'x');
    if ($handle === false) j(409, ['ok'=>false,'error'=>'replay_blocked']);
    fwrite($handle, (string)time());
    fclose($handle);
    @chmod($nonceFile, 0640);

    foreach (glob($nonceDir.'/*') ?: [] as $file) {
        if (is_file($file) && filemtime($file) < time() - 900) @unlink($file);
    }
}


function zip_entry_unsafe(string $name): bool {
    if ($name === '' || str_contains($name, "\0")) return true;
    $name = str_replace('\\', '/', $name);
    if (str_starts_with($name, '/') || preg_match('/^[A-Za-z]:\//', $name)) return true;
    foreach (explode('/', $name) as $part) {
        if ($part === '..') return true;
    }
    return strlen($name) > 500;
}

function zip_entry_symlink(ZipArchive $zip, int $index): bool {
    $opsys = 0; $attr = 0;
    if (!$zip->getExternalAttributesIndex($index, $opsys, $attr)) return false;
    if ($opsys !== ZipArchive::OPSYS_UNIX) return false;
    $mode = ($attr >> 16) & 0xF000;
    return $mode === 0xA000;
}

function inspect_private_source(string $key): never {
    if (!str_starts_with($key, 'incoming/')) j(403, ['ok'=>false,'error'=>'inspect_source_only']);
    $path = read_path($key);
    if (!is_file($path)) j(404, ['ok'=>false,'error'=>'not_found']);
    $size = filesize($path);
    if ($size === false || $size <= 0 || $size > GBD_MAX) j(422, ['ok'=>false,'error'=>'invalid_source_size']);

    $lower = strtolower($key);
    $ext = strtolower(pathinfo($lower, PATHINFO_EXTENSION));
    $sha = hash_file('sha256', $path);

    if ($ext === 'html' || $ext === 'htm') {
        $fh = @fopen($path, 'rb');
        if ($fh === false) j(500, ['ok'=>false,'error'=>'inspect_open_failed']);
        $prefix = fread($fh, min(65536, $size));
        fclose($fh);
        if ($prefix === false || str_contains($prefix, "\0")) j(415, ['ok'=>false,'error'=>'html_binary_content']);
        $prefix = preg_replace('/^\xEF\xBB\xBF/', '', $prefix) ?? $prefix;
        if (!preg_match('/<(?:!doctype\s+html\b|html\b)/i', $prefix)) {
            j(415, ['ok'=>false,'error'=>'html_signature_missing']);
        }
        j(200, [
            'ok'=>true,'kind'=>'html','bytes'=>$size,'sha256'=>$sha,
            'htmlDetected'=>true,'sourcePrivate'=>true,
        ]);
    }

    if ($ext !== 'zip' && $ext !== 'apk') {
        j(415, ['ok'=>false,'error'=>'inspect_unsupported_format']);
    }
    if (!class_exists('ZipArchive')) j(503, ['ok'=>false,'error'=>'zip_extension_unavailable']);

    $zip = new ZipArchive();
    $opened = $zip->open($path, ZipArchive::RDONLY);
    if ($opened !== true) j(415, ['ok'=>false,'error'=>'invalid_zip_container','zipCode'=>$opened]);

    $entryCount = $zip->numFiles;
    if ($entryCount < 1 || $entryCount > 10000) {
        $zip->close();
        j(422, ['ok'=>false,'error'=>'zip_entry_limit','entries'=>$entryCount]);
    }

    $totalUncompressed = 0;
    $largestEntry = 0;
    $unsafePath = null;
    $symlink = null;
    $encrypted = null;
    $hasIndex = false;
    $hasManifest = false;
    $hasAndroidManifest = false;
    $hasClassesDex = false;
    $sample = [];

    for ($i=0; $i<$entryCount; $i++) {
        $st = $zip->statIndex($i, ZipArchive::FL_UNCHANGED);
        if (!is_array($st)) { $zip->close(); j(422, ['ok'=>false,'error'=>'zip_stat_failed']); }
        $name = (string)($st['name'] ?? '');
        $usize = (int)($st['size'] ?? 0);
        $csize = (int)($st['comp_size'] ?? 0);

        if (zip_entry_unsafe($name)) { $unsafePath = $name; break; }
        if (zip_entry_symlink($zip, $i)) { $symlink = $name; break; }
        if (method_exists($zip, 'getEncryptionName')) {
            $encName = $zip->getEncryptionName($i);
            if (is_string($encName) && $encName !== '' && strtolower($encName) !== 'none') { $encrypted = $name; break; }
        }

        if ($usize < 0 || $csize < 0 || $usize > 268435456) {
            $zip->close();
            j(422, ['ok'=>false,'error'=>'zip_entry_size_limit','entry'=>$name]);
        }
        $totalUncompressed += $usize;
        $largestEntry = max($largestEntry, $usize);
        if ($totalUncompressed > 1073741824) {
            $zip->close();
            j(422, ['ok'=>false,'error'=>'zip_uncompressed_limit']);
        }

        $normalized = strtolower(ltrim(str_replace('\\','/',$name),'/'));
        $base = basename($normalized);
        if ($base === 'index.html' || $base === 'index.htm') $hasIndex = true;
        if ($base === 'manifest.webmanifest' || $base === 'manifest.json') $hasManifest = true;
        if ($normalized === 'androidmanifest.xml') $hasAndroidManifest = true;
        if ($normalized === 'classes.dex') $hasClassesDex = true;
        if (count($sample) < 20 && $name !== '') $sample[] = $name;
    }

    if ($unsafePath !== null) { $zip->close(); j(422, ['ok'=>false,'error'=>'zip_unsafe_path']); }
    if ($symlink !== null) { $zip->close(); j(422, ['ok'=>false,'error'=>'zip_symlink_blocked']); }
    if ($encrypted !== null) { $zip->close(); j(422, ['ok'=>false,'error'=>'zip_encrypted_entry_blocked']); }

    $ratio = $size > 0 ? $totalUncompressed / $size : 999999;
    if ($ratio > 100.0 && $totalUncompressed > 104857600) {
        $zip->close();
        j(422, ['ok'=>false,'error'=>'zip_bomb_ratio']);
    }
    $zip->close();

    if ($ext === 'apk' && (!$hasAndroidManifest || !$hasClassesDex)) {
        j(415, ['ok'=>false,'error'=>'apk_structure_invalid']);
    }

    j(200, [
        'ok'=>true,
        'kind'=>$ext,
        'bytes'=>$size,
        'sha256'=>$sha,
        'entries'=>$entryCount,
        'uncompressedBytes'=>$totalUncompressed,
        'largestEntryBytes'=>$largestEntry,
        'compressionRatio'=>round($ratio, 2),
        'hasIndexHtml'=>$hasIndex,
        'hasWebManifest'=>$hasManifest,
        'hasAndroidManifest'=>$hasAndroidManifest,
        'hasClassesDex'=>$hasClassesDex,
        'sampleEntries'=>$sample,
        'sourcePrivate'=>true,
    ]);
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET' && (string)($_GET['health'] ?? '') === '1') {
    $root = realpath(GBD_ROOT);
    j(200, [
        'ok'=>$root !== false && is_dir($root) && is_writable($root),
        'service'=>'gbd-storage-gateway',
        'storageSeparated'=>true,
        'writable'=>$root !== false && is_writable($root),
        'maxBytes'=>GBD_MAX,
    ]);
}

$key = (string)($_GET['key'] ?? '');
if ($key === '') j(400, ['ok'=>false,'error'=>'missing_key']);
$key = safe_key($key);
authorize_request($method, $key);

if ($method === 'POST') {
    inspect_private_source($key);
}

if ($method === 'PUT') {
    $path = write_path($key);
    if (is_file($path)) j(409, ['ok'=>false,'error'=>'object_exists']);

    $len = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : -1;
    if ($len <= 0 || $len > GBD_MAX) j(413, ['ok'=>false,'error'=>'size_not_allowed']);

    $input = @fopen('php://input', 'rb');
    if ($input === false) j(500, ['ok'=>false,'error'=>'open_failed']);

    $tmp = $path.'.upload-'.bin2hex(random_bytes(12));
    $output = @fopen($tmp, 'xb');
    if ($output === false) {
        fclose($input);
        j(500, ['ok'=>false,'error'=>'open_failed']);
    }

    $hash = hash_init('sha256');
    $bytes = 0;
    $failed = false;

    while (!feof($input)) {
        $chunk = fread($input, 1048576);
        if ($chunk === false) { $failed = true; break; }
        $chunkLen = strlen($chunk);
        if ($chunkLen === 0) continue;
        $bytes += $chunkLen;
        if ($bytes > GBD_MAX || $bytes > $len) { $failed = true; break; }
        hash_update($hash, $chunk);
        if (fwrite($output, $chunk) !== $chunkLen) { $failed = true; break; }
    }

    fclose($input);
    fflush($output);
    fclose($output);

    if ($failed || $bytes !== $len) {
        @unlink($tmp);
        j(422, ['ok'=>false,'error'=>'content_length_mismatch']);
    }

    $sha = hash_final($hash);
    $want = strtolower(trim((string)($_SERVER['HTTP_X_GBD_SHA256'] ?? '')));
    if ($want !== '' && (!preg_match('/^[a-f0-9]{64}$/', $want) || !hash_equals($want, $sha))) {
        @unlink($tmp);
        j(422, ['ok'=>false,'error'=>'sha256_mismatch']);
    }

    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        j(500, ['ok'=>false,'error'=>'commit_failed']);
    }
    @chmod($path, 0640);
    j(201, ['ok'=>true,'bytes'=>$bytes,'sha256'=>$sha]);
}

$path = read_path($key);

if ($method === 'HEAD') {
    if (!is_file($path)) j(404, ['ok'=>false,'error'=>'not_found']);
    $size = filesize($path);
    if ($size === false) j(500, ['ok'=>false,'error'=>'stat_failed']);
    header('Content-Length: '.$size);
    header('X-GBD-SHA256: '.hash_file('sha256', $path));
    http_response_code(200);
    exit;
}

if ($method === 'GET') {
    if (!is_file($path)) j(404, ['ok'=>false,'error'=>'not_found']);
    $size = filesize($path);
    if ($size === false || $size < 0) j(500, ['ok'=>false,'error'=>'stat_failed']);

    $start = 0;
    $end = max(0, $size - 1);
    $status = 200;
    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));

    if ($range !== '') {
        if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match)) {
            header('Content-Range: bytes */'.$size);
            j(416, ['ok'=>false,'error'=>'invalid_range']);
        }

        if ($match[1] === '' && $match[2] === '') {
            header('Content-Range: bytes */'.$size);
            j(416, ['ok'=>false,'error'=>'invalid_range']);
        }

        if ($match[1] === '') {
            $suffix = (int)$match[2];
            if ($suffix <= 0) {
                header('Content-Range: bytes */'.$size);
                j(416, ['ok'=>false,'error'=>'invalid_range']);
            }
            $start = max(0, $size - $suffix);
        } else {
            $start = (int)$match[1];
        }

        if ($match[1] !== '' && $match[2] !== '') {
            $end = min($size - 1, (int)$match[2]);
        }

        if ($start > $end || $start >= $size) {
            header('Content-Range: bytes */'.$size);
            j(416, ['ok'=>false,'error'=>'invalid_range']);
        }
        $status = 206;
    }

    http_response_code($status);
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="game.bin"');
    header('Accept-Ranges: bytes');
    header('Content-Length: '.($end - $start + 1));
    if ($status === 206) header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);

    $file = @fopen($path, 'rb');
    if ($file === false) j(500, ['ok'=>false,'error'=>'open_failed']);
    if (fseek($file, $start) !== 0) {
        fclose($file);
        j(500, ['ok'=>false,'error'=>'seek_failed']);
    }

    $remaining = $end - $start + 1;
    while ($remaining > 0 && !feof($file)) {
        $chunk = fread($file, min(1048576, $remaining));
        if ($chunk === false) break;
        if ($chunk === '') break;
        echo $chunk;
        $remaining -= strlen($chunk);
        if (connection_aborted()) break;
        flush();
    }
    fclose($file);
    exit;
}

if ($method === 'DELETE') {
    if (!is_file($path)) j(404, ['ok'=>false,'error'=>'not_found']);
    if (!@unlink($path)) j(500, ['ok'=>false,'error'=>'delete_failed']);
    j(200, ['ok'=>true,'deleted'=>true]);
}

j(405, ['ok'=>false,'error'=>'method_not_allowed']);
