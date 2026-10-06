<?php
declare(strict_types=1);

/* GBD private staging owner gate installer. Staging only. */
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

const GBD_OWNER_COOKIE = 'GBD_OWNER_TEST';
const GBD_GATE_BEGIN = '# BEGIN GBD OWNER TEST GATE';
const GBD_GATE_END = '# END GBD OWNER TEST GATE';

function h(string $v): string { return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function maintenance_data_dir(): string { return __DIR__ . '/chatgpt-maintenance/data'; }
function auth_file(): string { return maintenance_data_dir() . '/auth.json'; }
function htaccess_file(): string { return __DIR__ . '/.htaccess'; }
function client_subject(): string {
    $ip=(string)($_SERVER['REMOTE_ADDR']??'unknown');
    return hash('sha256',$ip);
}
function rate_file(): string { return maintenance_data_dir().'/owner-test-rate/'.client_subject().'.json'; }
function load_json(string $path): array {
    if(!is_file($path)) return [];
    $raw=@file_get_contents($path); if(!is_string($raw)||$raw==='') return [];
    $d=json_decode($raw,true); return is_array($d)?$d:[];
}
function atomic_write(string $path,string $bytes,int $mode=0644): void {
    $dir=dirname($path); if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir)) throw new RuntimeException('Ordner konnte nicht angelegt werden.');
    $tmp=$path.'.tmp-'.bin2hex(random_bytes(6));
    if(file_put_contents($tmp,$bytes,LOCK_EX)===false) throw new RuntimeException('Temporäre Datei konnte nicht geschrieben werden.');
    @chmod($tmp,$mode);
    if(!@rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('Datei konnte nicht atomar ersetzt werden.');}
}
function rate_state(): array {
    $s=load_json(rate_file());$now=time();
    if((int)($s['window_start']??0)<$now-900) return ['window_start'=>$now,'fails'=>0];
    return ['window_start'=>(int)($s['window_start']??$now),'fails'=>(int)($s['fails']??0)];
}
function can_try(): bool { return rate_state()['fails']<8; }
function note_fail(): void {
    $s=rate_state();$s['fails']++;
    $dir=dirname(rate_file());if(!is_dir($dir))@mkdir($dir,0700,true);
    atomic_write(rate_file(),json_encode($s,JSON_UNESCAPED_SLASHES),0600);
}
function clear_fails(): void { @unlink(rate_file()); }
function same_origin_post(): bool {
    $host=strtolower((string)($_SERVER['HTTP_HOST']??''));
    if($host!=='gamesbehinddoors.de'&&$host!=='www.gamesbehinddoors.de') return false;
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    if($origin!==''&&!in_array($origin,['https://gamesbehinddoors.de','https://www.gamesbehinddoors.de'],true)) return false;
    return true;
}
function remove_gate(string $bytes): string {
    $start=strpos($bytes,GBD_GATE_BEGIN);if($start===false)return ltrim($bytes);
    $end=strpos($bytes,GBD_GATE_END,$start);if($end===false)throw new RuntimeException('Vorhandener Owner-Gate-Marker ist beschädigt.');
    $end+=strlen(GBD_GATE_END);
    while(isset($bytes[$end])&&($bytes[$end]==="\r"||$bytes[$end]==="\n"))$end++;
    return ltrim(substr($bytes,0,$start).substr($bytes,$end));
}
function gate_block(string $token): string {
    if(!preg_match('/^[a-f0-9]{64}$/',$token))throw new RuntimeException('Ungültiger Gate-Token.');
    return GBD_GATE_BEGIN."\n"
      ."<IfModule mod_rewrite.c>\n"
      ."RewriteEngine On\n"
      ."# Wartungslogin und Owner-Gate bleiben erreichbar; alles andere braucht das zufällige Browser-Cookie.\n"
      ."RewriteRule ^chatgpt-maintenance(?:/|$) - [L]\n"
      ."RewriteRule ^gbd-storage-test\\.php$ - [L]\n"
      ."RewriteCond %{HTTP:Cookie} !(^|;[[:space:]]*)".GBD_OWNER_COOKIE."=".$token."(;|$) [NC]\n"
      ."RewriteRule ^ - [R=404,L]\n"
      ."</IfModule>\n"
      .GBD_GATE_END."\n\n";
}
function install_gate(string $token): void {
    $path=htaccess_file();if(!is_file($path))throw new RuntimeException('staging/.htaccess fehlt. Gate wurde nicht installiert.');
    $current=(string)file_get_contents($path);$clean=remove_gate($current);$next=gate_block($token).$clean;
    $backupDir=maintenance_data_dir().'/owner-gate-backups';if(!is_dir($backupDir)&&!mkdir($backupDir,0700,true)&&!is_dir($backupDir))throw new RuntimeException('Gate-Backupordner konnte nicht angelegt werden.');
    atomic_write($backupDir.'/htaccess-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.txt',$current,0600);
    $mode=fileperms($path)&0777;atomic_write($path,$next,$mode?:0644);
}
function current_token(): ?string {
    $path=htaccess_file();if(!is_file($path))return null;$raw=(string)file_get_contents($path);
    if(preg_match('/'.preg_quote(GBD_OWNER_COOKIE,'/').'=([a-f0-9]{64})/',$raw,$m))return $m[1];
    return null;
}
function set_owner_cookie(string $token): void {
    setcookie(GBD_OWNER_COOKIE,$token,[
      'expires'=>time()+43200,'path'=>'/staging/','secure'=>true,'httponly'=>true,'samesite'=>'Strict'
    ]);
}
function clear_owner_cookie(): void {
    setcookie(GBD_OWNER_COOKIE,'',[
      'expires'=>time()-3600,'path'=>'/staging/','secure'=>true,'httponly'=>true,'samesite'=>'Strict'
    ]);
}

$error=null;$success=null;
try{
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!same_origin_post())throw new RuntimeException('Ungültige Anfragequelle.');
        $action=(string)($_POST['action']??'login');
        if($action==='login'){
            if(!can_try())throw new RuntimeException('Zu viele Fehlversuche. 15 Minuten warten.');
            $auth=load_json(auth_file());$hash=(string)($auth['password_hash']??'');$password=(string)($_POST['password']??'');
            if($hash===''||!password_verify($password,$hash)){note_fail();throw new RuntimeException('Anmeldung fehlgeschlagen.');}
            clear_fails();$token=bin2hex(random_bytes(32));install_gate($token);set_owner_cookie($token);
            header('Location: /staging/',true,303);exit;
        }
        if($action==='logout'){
            $token=bin2hex(random_bytes(32));install_gate($token);clear_owner_cookie();$success='Privater Testzugang wurde widerrufen. Staging bleibt für alle mit 404 gesperrt.';
        }else if($action!=='login') throw new RuntimeException('Unbekannte Aktion.');
    }
}catch(Throwable $e){$error=$e->getMessage();}

$token=current_token();$cookie=(string)($_COOKIE[GBD_OWNER_COOKIE]??'');$active=$token!==null&&$cookie!==''&&hash_equals($token,$cookie);
?><!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>GBD Privater Testzugang</title><style>
:root{color-scheme:dark;font:16px/1.5 system-ui;background:#0f1115;color:#eef2f7}body{margin:0}main{max-width:560px;margin:8vh auto;padding:24px}.card{background:#181c23;border:1px solid #303744;border-radius:16px;padding:22px}h1{margin-top:0}p{color:#b9c1ce}label{display:block;margin:16px 0 8px}input{box-sizing:border-box;width:100%;padding:12px;border-radius:9px;border:1px solid #465064;background:#0d1117;color:white}button,a.btn{margin-top:14px;border:0;border-radius:9px;padding:11px 15px;font-weight:700;background:#edf2f7;color:#111827;text-decoration:none;display:inline-block;cursor:pointer}.secondary{background:#343c49!important;color:white!important}.ok{padding:12px;border-radius:10px;background:#15301f;color:#bdf4cd}.err{padding:12px;border-radius:10px;background:#35191d;color:#ffc7ce}.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#243040;color:#dce5f2}</style></head><body><main><div class="card"><span class="badge">GBD • OWNER TEST</span><h1>Privater Staging-Testzugang</h1><p>Dieser Zugang ändert keine öffentliche Freigabe. Ohne gültiges, zufällig erzeugtes Browser-Cookie antwortet <code>/staging/</code> mit HTTP 404.</p>
<?php if($error):?><div class="err"><?=h($error)?></div><?php endif;?><?php if($success):?><div class="ok"><?=h($success)?></div><?php endif;?>
<?php if($active):?><div class="ok">Dieser Browser hat aktuell privaten Testzugang.</div><a class="btn" href="/staging/">Staging öffnen</a><form method="post"><input type="hidden" name="action" value="logout"><button class="secondary" type="submit">Testzugang widerrufen</button></form>
<?php else:?><form method="post" autocomplete="off"><input type="hidden" name="action" value="login"><label for="password">Wartungs-Passwort</label><input id="password" name="password" type="password" minlength="16" required autocomplete="current-password"><button type="submit">Privaten Testzugang aktivieren</button></form><?php endif;?>
<p><small>0/3, PayPal-LIVE und die öffentliche Plattform werden hierdurch nicht aktiviert.</small></p></div></main></body></html>
