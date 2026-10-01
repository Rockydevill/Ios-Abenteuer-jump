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
header('Access-Control-Allow-Headers: Content-Type,Content-Length,Range,X-GBD-Timestamp,X-GBD-Nonce,X-GBD-Signature,X-GBD-SHA256,X-GBD-Action,X-GBD-Body-SHA256');
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

function authorize_request(string $method, string $key, string $action = '', string $bodySha = ''): void {
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
    if ($action !== '') {
        if (!preg_match('/^[a-z0-9_]{3,40}$/', $action)) j(401, ['ok'=>false,'error'=>'bad_action']);
        if (!preg_match('/^[a-f0-9]{64}$/', $bodySha)) j(401, ['ok'=>false,'error'=>'bad_body_hash']);
        $canonical .= "\n".$action."\n".$bodySha;
    }
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


function gbd_u16(string $s, int $o): int {
    $v = unpack('v', substr($s, $o, 2));
    if (!is_array($v)) throw new RuntimeException('axml_u16_failed');
    return (int)$v[1];
}
function gbd_u32(string $s, int $o): int {
    $v = unpack('V', substr($s, $o, 4));
    if (!is_array($v)) throw new RuntimeException('axml_u32_failed');
    return (int)$v[1];
}
function gbd_set_u32(string &$s, int $o, int $v): void {
    $s = substr_replace($s, pack('V', $v), $o, 4);
}
function gbd_utf16_decode(string $bytes): string {
    if (function_exists('mb_convert_encoding')) return mb_convert_encoding($bytes, 'UTF-8', 'UTF-16LE');
    $r = iconv('UTF-16LE', 'UTF-8', $bytes);
    if ($r === false) throw new RuntimeException('utf16_decode_failed');
    return $r;
}
function gbd_utf16_encode(string $value): string {
    if (function_exists('mb_convert_encoding')) return mb_convert_encoding($value, 'UTF-16LE', 'UTF-8');
    $r = iconv('UTF-8', 'UTF-16LE', $value);
    if ($r === false) throw new RuntimeException('utf16_encode_failed');
    return $r;
}
function gbd_axml_read_utf16(string $xml, int $off): string {
    $w1 = gbd_u16($xml, $off);
    $p = $off + 2;
    if (($w1 & 0x8000) !== 0) {
        $w2 = gbd_u16($xml, $p);
        $p += 2;
        $len = (($w1 & 0x7fff) << 16) | $w2;
    } else {
        $len = $w1;
    }
    return gbd_utf16_decode(substr($xml, $p, $len * 2));
}
function gbd_patch_manifest(string $xml, string $package, string $label, string $versionName, int $versionCode): string {
    if (strlen($xml) < 16 || gbd_u16($xml, 0) !== 0x0003) throw new RuntimeException('manifest_not_binary_axml');
    $sp = 8;
    if (gbd_u16($xml, $sp) !== 0x0001) throw new RuntimeException('manifest_string_pool_missing');
    $headerSize = gbd_u16($xml, $sp + 2);
    $oldSize = gbd_u32($xml, $sp + 4);
    $count = gbd_u32($xml, $sp + 8);
    $styleCount = gbd_u32($xml, $sp + 12);
    $flags = gbd_u32($xml, $sp + 16);
    $stringsStart = gbd_u32($xml, $sp + 20);
    if ($headerSize !== 28 || $styleCount !== 0 || ($flags & 0x100) !== 0 || $count < 10 || $count > 1000) {
        throw new RuntimeException('manifest_string_pool_unsupported');
    }

    $base = $sp + $stringsStart;
    $strings = [];
    for ($i = 0; $i < $count; $i++) {
        $off = gbd_u32($xml, $sp + 28 + $i * 4);
        $strings[] = gbd_axml_read_utf16($xml, $base + $off);
    }
    $find = static function(string $needle) use ($strings): int {
        $i = array_search($needle, $strings, true);
        if ($i === false) throw new RuntimeException('manifest_placeholder_missing');
        return (int)$i;
    };
    $pkgI = $find('com.gbd.games.template');
    $labelI = $find('GBD Web Game');
    $verI = $find('1.0');
    $versionCodeName = $find('versionCode');
    $manifestName = $find('manifest');

    $strings[$pkgI] = $package;
    $strings[$labelI] = $label;
    $strings[$verI] = $versionName;

    $data = '';
    $offsets = [];
    foreach ($strings as $value) {
        $offsets[] = strlen($data);
        $enc = gbd_utf16_encode($value);
        $units = intdiv(strlen($enc), 2);
        if ($units >= 0x8000) throw new RuntimeException('manifest_string_too_long');
        $data .= pack('v', $units).$enc."\0\0";
    }
    while ((strlen($data) % 4) !== 0) $data .= "\0";

    $newStringsStart = 28 + $count * 4;
    $newSize = $newStringsStart + strlen($data);
    $chunk = pack('vvV', 0x0001, 28, $newSize).pack('VVVVV', $count, 0, $flags, $newStringsStart, 0);
    foreach ($offsets as $off) $chunk .= pack('V', $off);
    $chunk .= $data;

    $out = substr($xml, 0, $sp).$chunk.substr($xml, $sp + $oldSize);
    gbd_set_u32($out, 4, strlen($out));

    $pos = $sp + $newSize;
    $patched = false;
    while ($pos < strlen($out)) {
        if ($pos + 8 > strlen($out)) throw new RuntimeException('manifest_chunk_truncated');
        $type = gbd_u16($out, $pos);
        $size = gbd_u32($out, $pos + 4);
        if ($size < 8 || $pos + $size > strlen($out)) throw new RuntimeException('manifest_chunk_invalid');
        if ($type === 0x0102) {
            $nameIdx = gbd_u32($out, $pos + 20);
            if ($nameIdx === $manifestName) {
                $attrStart = gbd_u16($out, $pos + 24);
                $attrSize = gbd_u16($out, $pos + 26);
                $attrCount = gbd_u16($out, $pos + 28);
                $ap = $pos + 16 + $attrStart;
                for ($i = 0; $i < $attrCount; $i++) {
                    $a = $ap + $i * $attrSize;
                    if (gbd_u32($out, $a + 4) === $versionCodeName) {
                        $out = substr_replace($out, pack('V', $versionCode), $a + 16, 4);
                        $patched = true;
                        break;
                    }
                }
            }
        }
        $pos += $size;
    }
    if (!$patched) throw new RuntimeException('manifest_version_code_missing');
    return $out;
}

function gbd_rm_tree(string $path): void {
    if (!is_dir($path)) { if (is_file($path)) @unlink($path); return; }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $item) {
        if ($item->isDir() && !$item->isLink()) @rmdir($item->getPathname());
        else @unlink($item->getPathname());
    }
    @rmdir($path);
}

function gbd_run(array $cmd): array {
    if (!function_exists('proc_open')) throw new RuntimeException('proc_open_unavailable');
    $spec = [0=>['pipe','r'], 1=>['pipe','w'], 2=>['pipe','w']];
    $p = proc_open($cmd, $spec, $pipes, null, null, ['bypass_shell'=>true]);
    if (!is_resource($p)) throw new RuntimeException('process_start_failed');
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
    $code = proc_close($p);
    return ['code'=>$code,'stdout'=>(string)$stdout,'stderr'=>(string)$stderr];
}

function gbd_download(string $url, string $dest, int $maxBytes): void {
    $fh = @fopen($dest, 'xb');
    if ($fh === false) throw new RuntimeException('download_open_failed');
    $bytes = 0;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION=>true,
        CURLOPT_MAXREDIRS=>3,
        CURLOPT_CONNECTTIMEOUT=>15,
        CURLOPT_TIMEOUT=>120,
        CURLOPT_USERAGENT=>'GBD-Package-Builder/1',
        CURLOPT_FAILONERROR=>true,
        CURLOPT_RETURNTRANSFER=>false,
        CURLOPT_HEADER=>false,
        CURLOPT_WRITEFUNCTION=>static function($ch, string $data) use ($fh, &$bytes, $maxBytes) {
            $bytes += strlen($data);
            if ($bytes > $maxBytes) return 0;
            return fwrite($fh, $data);
        },
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,
    ]);
    $ok = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    fclose($fh);
    if ($ok !== true || $bytes <= 0 || $bytes > $maxBytes) {
        @unlink($dest);
        throw new RuntimeException('download_failed:'.$err);
    }
}

function gbd_ensure_apksig_tools(): array {
    $arch = strtolower((string)php_uname('m'));
    if (!in_array($arch, ['aarch64','arm64'], true)) throw new RuntimeException('unsupported_builder_arch');
    $root = '/home/www/gamesbehinddoors-tools/apksig-go-v1.1.0';
    $sign = $root.'/apksign';
    $verify = $root.'/apksigverify';
    $certinfo = $root.'/certinfo';
    if (is_file($sign) && is_executable($sign) && is_file($verify) && is_executable($verify) && is_file($certinfo) && is_executable($certinfo)) {
        return [$sign, $verify, $certinfo];
    }
    if (!is_dir($root) && !@mkdir($root, 0750, true)) throw new RuntimeException('tools_mkdir_failed');
    $tmp = $root.'/.install-'.bin2hex(random_bytes(8));
    if (!@mkdir($tmp, 0750, true)) throw new RuntimeException('tools_stage_failed');
    try {
        $archive = $tmp.'/apksig.tar.gz';
        gbd_download(
            'https://github.com/agusibrahim/apksig-go/releases/download/v1.1.0/apksig-go_v1.1.0_linux_arm64.tar.gz',
            $archive,
            8000000
        );
        $want = '76cd7866ee7099f11227ee9dc13c75710de83f896a3ffc33b157e8b5c6c1e755';
        if (!hash_equals($want, hash_file('sha256', $archive))) throw new RuntimeException('tools_checksum_mismatch');
        $run = gbd_run(['tar','-xzf',$archive,'-C',$tmp]);
        if ($run['code'] !== 0) throw new RuntimeException('tools_extract_failed');
        $foundSign = null; $foundVerify = null; $foundCertinfo = null;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $item) {
            if (!$item->isFile()) continue;
            if ($item->getFilename() === 'apksign') $foundSign = $item->getPathname();
            if ($item->getFilename() === 'apksigverify') $foundVerify = $item->getPathname();
            if ($item->getFilename() === 'certinfo') $foundCertinfo = $item->getPathname();
        }
        if (!$foundSign || !$foundVerify || !$foundCertinfo) throw new RuntimeException('tools_binaries_missing');
        if (!@copy($foundSign, $sign) || !@copy($foundVerify, $verify) || !@copy($foundCertinfo, $certinfo)) throw new RuntimeException('tools_copy_failed');
        @chmod($sign, 0750); @chmod($verify, 0750); @chmod($certinfo, 0750);
        if (!is_executable($sign) || !is_executable($verify) || !is_executable($certinfo)) throw new RuntimeException('tools_not_executable');
    } finally {
        gbd_rm_tree($tmp);
    }
    return [$sign, $verify, $certinfo];
}

function gbd_fetch_wrapper_template(string $dest): void {
    $b64 = $dest.'.b64';
    gbd_download(
        'https://raw.githubusercontent.com/Rockydevill/Ios-Abenteuer-jump/gbd-strato-bridge/gbd-strato-bridge/tools/GBD-WebWrapper-Template-v1-UNSIGNED.apk.gz.b64',
        $b64,
        20000
    );
    $txt = trim((string)file_get_contents($b64));
    @unlink($b64);
    $gz = base64_decode($txt, true);
    if ($gz === false) throw new RuntimeException('template_base64_invalid');
    $apk = gzdecode($gz);
    if ($apk === false) throw new RuntimeException('template_gzip_invalid');
    $want = '197df8599d267883f41451edcdadd98f0e91f8e2c039800dd54a1d6f6b911ff2';
    if (!hash_equals($want, hash('sha256', $apk))) throw new RuntimeException('template_checksum_mismatch');
    if (file_put_contents($dest, $apk, LOCK_EX) !== strlen($apk)) throw new RuntimeException('template_write_failed');
    @chmod($dest, 0640);
}

function gbd_signing_material(string $ref): array {
    if (!preg_match('/^[A-Za-z0-9_-]{8,128}$/', $ref)) throw new RuntimeException('signing_ref_invalid');
    $hash = hash('sha256', $ref);
    $dir = '/home/www/gamesbehinddoors-secrets/android-signing/'.$hash;
    $keyFile = $dir.'/key.pem';
    $certFile = $dir.'/cert.pem';
    if (!is_file($keyFile) || !is_file($certFile)) {
        if (!is_dir($dir) && !@mkdir($dir, 0700, true)) throw new RuntimeException('signing_dir_failed');
        $key = openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
        if ($key === false) throw new RuntimeException('signing_key_generate_failed');
        $dn = ['commonName'=>'Games Behind Doors Web Game '.substr($hash,0,12),'organizationName'=>'Games Behind Doors','countryName'=>'DE'];
        $csr = openssl_csr_new($dn, $key, ['digest_alg'=>'sha256']);
        if ($csr === false) throw new RuntimeException('signing_csr_failed');
        $cert = openssl_csr_sign($csr, null, $key, 10950, ['digest_alg'=>'sha256']);
        if ($cert === false) throw new RuntimeException('signing_cert_failed');
        $keyPem = ''; $certPem = '';
        if (!openssl_pkey_export($key, $keyPem) || !openssl_x509_export($cert, $certPem)) throw new RuntimeException('signing_export_failed');
        $kt = $keyFile.'.tmp-'.bin2hex(random_bytes(6));
        $ct = $certFile.'.tmp-'.bin2hex(random_bytes(6));
        if (file_put_contents($kt, $keyPem, LOCK_EX) === false || file_put_contents($ct, $certPem, LOCK_EX) === false) throw new RuntimeException('signing_write_failed');
        @chmod($kt, 0600); @chmod($ct, 0600);
        if (!@rename($kt, $keyFile) || !@rename($ct, $certFile)) throw new RuntimeException('signing_commit_failed');
    }
    $cert = openssl_x509_read((string)file_get_contents($certFile));
    if ($cert === false) throw new RuntimeException('signing_cert_read_failed');
    $fp = openssl_x509_fingerprint($cert, 'sha256');
    if (!is_string($fp) || $fp === '') throw new RuntimeException('signing_cert_fingerprint_failed');
    return [$keyFile, $certFile, strtolower(str_replace(':','',$fp))];
}


function gbd_manifest_identity(string $xml): array {
    if (strlen($xml) < 16 || gbd_u16($xml, 0) !== 0x0003) throw new RuntimeException('manifest_not_binary_axml');
    $sp = 8;
    if (gbd_u16($xml, $sp) !== 0x0001) throw new RuntimeException('manifest_string_pool_missing');
    $poolSize = gbd_u32($xml, $sp + 4);
    $count = gbd_u32($xml, $sp + 8);
    $styleCount = gbd_u32($xml, $sp + 12);
    $flags = gbd_u32($xml, $sp + 16);
    $stringsStart = gbd_u32($xml, $sp + 20);
    if ($styleCount !== 0 || ($flags & 0x100) !== 0 || $count < 5 || $count > 5000) throw new RuntimeException('manifest_pool_unsupported');
    $base = $sp + $stringsStart;
    $strings = [];
    for ($i=0; $i<$count; $i++) {
        $off = gbd_u32($xml, $sp + 28 + $i * 4);
        $strings[] = gbd_axml_read_utf16($xml, $base + $off);
    }
    $out = ['packageName'=>null,'versionName'=>null,'versionCode'=>null,'minSdk'=>null,'targetSdk'=>null];
    $pos = $sp + $poolSize;
    while ($pos < strlen($xml)) {
        $type = gbd_u16($xml, $pos);
        $size = gbd_u32($xml, $pos + 4);
        if ($size < 8 || $pos + $size > strlen($xml)) throw new RuntimeException('manifest_chunk_invalid');
        if ($type === 0x0102) {
            $nameIdx = gbd_u32($xml, $pos + 20);
            $element = $strings[$nameIdx] ?? '';
            if ($element === 'manifest' || $element === 'uses-sdk') {
                $attrStart = gbd_u16($xml, $pos + 24);
                $attrSize = gbd_u16($xml, $pos + 26);
                $attrCount = gbd_u16($xml, $pos + 28);
                $ap = $pos + 16 + $attrStart;
                for ($i=0; $i<$attrCount; $i++) {
                    $a = $ap + $i * $attrSize;
                    $name = $strings[gbd_u32($xml, $a + 4)] ?? '';
                    $raw = gbd_u32($xml, $a + 8);
                    $dtype = ord($xml[$a + 15]);
                    $data = gbd_u32($xml, $a + 16);
                    $stringValue = null;
                    if ($raw !== 0xffffffff && isset($strings[$raw])) $stringValue = $strings[$raw];
                    elseif ($dtype === 0x03 && isset($strings[$data])) $stringValue = $strings[$data];

                    if ($element === 'manifest' && $name === 'package') $out['packageName'] = $stringValue;
                    if ($element === 'manifest' && $name === 'versionName') $out['versionName'] = $stringValue;
                    if ($element === 'manifest' && $name === 'versionCode') $out['versionCode'] = $data;
                    if ($element === 'uses-sdk' && $name === 'minSdkVersion') $out['minSdk'] = $data;
                    if ($element === 'uses-sdk' && $name === 'targetSdkVersion') $out['targetSdk'] = $data;
                }
            }
        }
        $pos += $size;
    }
    if (!is_string($out['packageName']) || $out['packageName'] === '' || !is_int($out['versionCode'])) throw new RuntimeException('manifest_identity_missing');
    return $out;
}

function gbd_verify_apk_source(string $sourceKey): never {
    if (!str_starts_with($sourceKey, 'incoming/')) j(403, ['ok'=>false,'error'=>'verify_source_only']);
    $path = read_path($sourceKey);
    if (!is_file($path)) j(404, ['ok'=>false,'error'=>'not_found']);
    $size = filesize($path);
    if ($size === false || $size <= 0 || $size > GBD_MAX) j(422, ['ok'=>false,'error'=>'invalid_source_size']);

    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::RDONLY) !== true) j(415, ['ok'=>false,'error'=>'apk_zip_invalid']);
    $manifest = $zip->getFromName('AndroidManifest.xml');
    $dex = $zip->locateName('classes.dex', ZipArchive::FL_NOCASE);
    $zip->close();
    if (!is_string($manifest) || $dex === false) j(415, ['ok'=>false,'error'=>'apk_structure_invalid']);

    try {
        $identity = gbd_manifest_identity($manifest);
        [$apksign, $verify, $certinfo] = gbd_ensure_apksig_tools();
        $verifyRun = gbd_run([$verify, '-v', $path]);
        $combined = strtolower($verifyRun['stdout'].$verifyRun['stderr']);
        if ($verifyRun['code'] !== 0 || !str_contains($combined, 'verified: true')) throw new RuntimeException('apk_signature_invalid');
        $certRun = gbd_run([$certinfo, $path]);
        if ($certRun['code'] !== 0) throw new RuntimeException('apk_certinfo_failed');
        if (!preg_match('/Signer #1 cert SHA-256:\s*([a-fA-F0-9]{64})/', $certRun['stdout'].$certRun['stderr'], $m)) {
            throw new RuntimeException('apk_signer_cert_missing');
        }
        j(200, [
            'ok'=>true,
            'kind'=>'apk',
            'bytes'=>$size,
            'sha256'=>hash_file('sha256', $path),
            'packageName'=>$identity['packageName'],
            'versionName'=>$identity['versionName'],
            'versionCode'=>$identity['versionCode'],
            'minSdk'=>$identity['minSdk'],
            'targetSdk'=>$identity['targetSdk'],
            'signingCertSha256'=>strtolower($m[1]),
            'signatureVerified'=>true,
            'sourcePrivate'=>true,
            'directSourceDownload'=>false,
            'verifier'=>'apksig-go-v1.1.0',
        ]);
    } catch (Throwable $e) {
        error_log('GBD APK verify failed: '.$e->getMessage());
        j(422, ['ok'=>false,'error'=>'apk_verification_failed','detail'=>$e->getMessage()]);
    }
}

function gbd_web_asset_rel(string $name): string {
    $name = ltrim(str_replace('\\','/',$name), '/');
    if ($name === '' || strlen($name) > 500 || str_contains($name, '..') || str_contains($name, "\0")) throw new RuntimeException('web_asset_path_invalid');
    return $name;
}
function gbd_web_asset_blocked(string $rel): bool {
    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    return in_array($ext, ['php','phtml','phar','cgi','pl','py','rb','sh','bash','zsh','bat','cmd','ps1','exe','dll','dylib','so','apk','aab','apks','xapk','dex','class','jar'], true);
}

function gbd_build_web_wrapper(string $sourceKey, array $body): never {
    if (!str_starts_with($sourceKey, 'incoming/')) j(403, ['ok'=>false,'error'=>'build_source_only']);
    $source = read_path($sourceKey);
    if (!is_file($source)) j(404, ['ok'=>false,'error'=>'not_found']);
    $sourceSize = filesize($source);
    if ($sourceSize === false || $sourceSize <= 0 || $sourceSize > GBD_MAX) j(422, ['ok'=>false,'error'=>'invalid_source_size']);

    $format = strtolower(trim((string)($body['sourceFormat'] ?? '')));
    if (!in_array($format, ['html','htm','html_zip','pwa_zip','zip'], true)) j(415, ['ok'=>false,'error'=>'build_format_unsupported']);
    $package = strtolower(trim((string)($body['packageName'] ?? '')));
    if (!preg_match('/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/', $package) || strlen($package) > 150) j(422, ['ok'=>false,'error'=>'package_name_invalid']);
    $label = trim((string)($body['label'] ?? ''));
    $labelLength = function_exists('mb_strlen') ? mb_strlen($label, 'UTF-8') : strlen($label);
    if ($label === '' || $labelLength > 80) j(422, ['ok'=>false,'error'=>'label_invalid']);
    $versionName = trim((string)($body['versionName'] ?? '1.0'));
    if ($versionName === '' || strlen($versionName) > 50) j(422, ['ok'=>false,'error'=>'version_name_invalid']);
    $versionCode = (int)($body['versionCode'] ?? 0);
    if ($versionCode < 1 || $versionCode > 2100000000) j(422, ['ok'=>false,'error'=>'version_code_invalid']);
    $artifactKey = safe_key((string)($body['artifactKey'] ?? ''));
    if (!preg_match('#^artifacts/[A-Za-z0-9._/-]+\.apk$#', $artifactKey) || str_contains($artifactKey, '..')) j(422, ['ok'=>false,'error'=>'artifact_key_invalid']);
    $signingRef = trim((string)($body['signingKeyRef'] ?? ''));

    $workRoot = '/home/www/gamesbehinddoors-build-work';
    if (!is_dir($workRoot) && !@mkdir($workRoot, 0750, true)) j(500, ['ok'=>false,'error'=>'build_root_failed']);
    $work = $workRoot.'/job-'.bin2hex(random_bytes(12));
    if (!@mkdir($work, 0750, true)) j(500, ['ok'=>false,'error'=>'build_stage_failed']);

    $result = null;
    $buildError = null;
    try {
        [$apksign, $apksigverify, $certinfo] = gbd_ensure_apksig_tools();
        [$keyFile, $certFile, $certSha] = gbd_signing_material($signingRef);

        $unsigned = $work.'/unsigned.apk';
        gbd_fetch_wrapper_template($unsigned);

        $apk = new ZipArchive();
        if ($apk->open($unsigned) !== true) throw new RuntimeException('template_open_failed');
        $manifest = $apk->getFromName('AndroidManifest.xml');
        if (!is_string($manifest)) { $apk->close(); throw new RuntimeException('template_manifest_missing'); }
        $manifest = gbd_patch_manifest($manifest, $package, $label, $versionName, $versionCode);
        if (!$apk->deleteName('AndroidManifest.xml') || !$apk->addFromString('AndroidManifest.xml', $manifest)) {
            $apk->close(); throw new RuntimeException('manifest_replace_failed');
        }
        $apk->deleteName('assets/index.html');

        if ($format === 'html' || $format === 'htm') {
            $prefix = file_get_contents($source, false, null, 0, min(65536, $sourceSize));
            if (!is_string($prefix) || str_contains($prefix, "\0") || !preg_match('/<(?:!doctype\s+html\b|html\b)/i', preg_replace('/^\xEF\xBB\xBF/', '', $prefix) ?? $prefix)) {
                $apk->close(); throw new RuntimeException('html_signature_missing');
            }
            if (!$apk->addFile($source, 'assets/index.html')) { $apk->close(); throw new RuntimeException('html_add_failed'); }
        } else {
            $srcZip = new ZipArchive();
            if ($srcZip->open($source, ZipArchive::RDONLY) !== true) { $apk->close(); throw new RuntimeException('source_zip_invalid'); }
            if ($srcZip->numFiles < 1 || $srcZip->numFiles > 10000) { $srcZip->close(); $apk->close(); throw new RuntimeException('zip_entry_limit'); }

            $candidates = [];
            $total = 0;
            for ($i=0; $i<$srcZip->numFiles; $i++) {
                $st = $srcZip->statIndex($i, ZipArchive::FL_UNCHANGED);
                if (!is_array($st)) throw new RuntimeException('zip_stat_failed');
                $name = gbd_web_asset_rel((string)($st['name'] ?? ''));
                if (str_ends_with($name, '/')) continue;
                if (zip_entry_symlink($srcZip, $i)) throw new RuntimeException('zip_symlink_blocked');
                $usize = (int)($st['size'] ?? 0);
                if ($usize < 0 || $usize > 268435456) throw new RuntimeException('zip_entry_size_limit');
                $total += $usize;
                if ($total > 536870912) throw new RuntimeException('build_uncompressed_limit');
                $base = strtolower(basename($name));
                if ($base === 'index.html' || $base === 'index.htm') $candidates[] = $name;
            }
            if (!$candidates) { $srcZip->close(); $apk->close(); throw new RuntimeException('index_html_missing'); }
            usort($candidates, static function(string $a,string $b):int {
                $da = substr_count($a,'/'); $db = substr_count($b,'/');
                return $da === $db ? strlen($a) <=> strlen($b) : $da <=> $db;
            });
            $entry = $candidates[0];
            $slash = strrpos($entry, '/');
            $prefixRoot = $slash === false ? '' : substr($entry, 0, $slash + 1);
            $assetsTmp = $work.'/assets';
            if (!@mkdir($assetsTmp, 0750, true)) throw new RuntimeException('assets_stage_failed');

            for ($i=0; $i<$srcZip->numFiles; $i++) {
                $st = $srcZip->statIndex($i, ZipArchive::FL_UNCHANGED);
                if (!is_array($st)) throw new RuntimeException('zip_stat_failed');
                $name = gbd_web_asset_rel((string)($st['name'] ?? ''));
                if (str_ends_with($name, '/') || !str_starts_with($name, $prefixRoot)) continue;
                $rel = substr($name, strlen($prefixRoot));
                if ($rel === '') continue;
                $rel = gbd_web_asset_rel($rel);
                if (gbd_web_asset_blocked($rel)) throw new RuntimeException('web_asset_type_blocked');
                $stream = $srcZip->getStream((string)$st['name']);
                if (!is_resource($stream)) throw new RuntimeException('web_asset_read_failed');
                $tmpPath = $assetsTmp.'/'.hash('sha256', $rel);
                $out = @fopen($tmpPath, 'xb');
                if ($out === false) { fclose($stream); throw new RuntimeException('web_asset_stage_failed'); }
                $written = stream_copy_to_stream($stream, $out, 268435457);
                fclose($stream); fclose($out);
                if ($written === false || $written !== (int)($st['size'] ?? 0)) throw new RuntimeException('web_asset_size_mismatch');
                if (!$apk->addFile($tmpPath, 'assets/'.$rel)) throw new RuntimeException('web_asset_add_failed');
            }
            $srcZip->close();
        }

        if (!$apk->close()) throw new RuntimeException('unsigned_apk_close_failed');

        $signed = $work.'/signed.apk';
        $signRun = gbd_run([$apksign,'-key',$keyFile,'-cert',$certFile,'-v1','-v3','-align','-in',$unsigned,'-out',$signed]);
        if ($signRun['code'] !== 0 || !is_file($signed)) throw new RuntimeException('apk_sign_failed');
        $verifyRun = gbd_run([$apksigverify,'-v',$signed]);
        if ($verifyRun['code'] !== 0 || !str_contains(strtolower($verifyRun['stdout'].$verifyRun['stderr']), 'verified: true')) {
            throw new RuntimeException('apk_verify_failed');
        }

        $artifactPath = write_path($artifactKey);
        if (is_file($artifactPath)) throw new RuntimeException('artifact_exists');
        $tmpArtifact = $artifactPath.'.build-'.bin2hex(random_bytes(8));
        if (!@copy($signed, $tmpArtifact)) throw new RuntimeException('artifact_copy_failed');
        @chmod($tmpArtifact, 0640);
        if (!@rename($tmpArtifact, $artifactPath)) { @unlink($tmpArtifact); throw new RuntimeException('artifact_commit_failed'); }

        $bytes = filesize($artifactPath);
        $sha = hash_file('sha256', $artifactPath);
        $result = [
            'ok'=>true,
            'kind'=>'android_apk',
            'artifactKey'=>$artifactKey,
            'bytes'=>$bytes,
            'sha256'=>$sha,
            'packageName'=>$package,
            'versionName'=>$versionName,
            'versionCode'=>$versionCode,
            'signingCertSha256'=>$certSha,
            'signatureVerified'=>true,
            'sourcePrivate'=>true,
            'directSourceDownload'=>false,
            'builder'=>'gbd-wrapper-v1-apksig-go-v1.1.0',
        ];
    } catch (Throwable $e) {
        $buildError = $e->getMessage();
        error_log('GBD build failed: '.$buildError);
    } finally {
        gbd_rm_tree($work);
    }
    if ($buildError !== null) j(422, ['ok'=>false,'error'=>'build_failed','detail'=>$buildError]);
    if (!is_array($result)) j(500, ['ok'=>false,'error'=>'build_result_missing']);
    j(201, $result);
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

$action = strtolower(trim((string)($_SERVER['HTTP_X_GBD_ACTION'] ?? '')));
$rawBody = '';
$bodySha = '';
if ($method === 'POST' && $action !== '') {
    $rawBody = (string)file_get_contents('php://input');
    if (strlen($rawBody) > 65536) j(413, ['ok'=>false,'error'=>'builder_request_too_large']);
    $bodySha = hash('sha256', $rawBody);
    $sentBodySha = strtolower(trim((string)($_SERVER['HTTP_X_GBD_BODY_SHA256'] ?? '')));
    if (!preg_match('/^[a-f0-9]{64}$/', $sentBodySha) || !hash_equals($bodySha, $sentBodySha)) {
        j(401, ['ok'=>false,'error'=>'body_hash_mismatch']);
    }
}
authorize_request($method, $key, $action, $bodySha);

if ($method === 'POST') {
    if ($action === '') inspect_private_source($key);
    if ($action === 'build_web') {
        $body = json_decode($rawBody, true);
        if (!is_array($body)) j(400, ['ok'=>false,'error'=>'invalid_builder_json']);
        gbd_build_web_wrapper($key, $body);
    }
    if ($action === 'verify_apk') {
        gbd_verify_apk_source($key);
    }
    j(400, ['ok'=>false,'error'=>'unsupported_action']);
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
