<?php
declare(strict_types=1);
/* GBD private staging bootstrap - Work Order GBD-2026-10-06-039 */
const GBD_OWNER_COOKIE='GBD_OWNER_TEST';
const GBD_LINK_TOKEN_SHA256='1d52de4aa5290bf6a973d336cf13cc50e05c4e30b2d89aeef7e33ff2a209a79c';
const GBD_GATE_BEGIN='# BEGIN GBD OWNER TEST GATE';
const GBD_GATE_END='# END GBD OWNER TEST GATE';
function sec():void{
 header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
 header('Pragma: no-cache'); header('Expires: 0');
 header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet',true);
 header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: no-referrer');
 header('X-Frame-Options: DENY');
 header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}
function nf(string $kind='html'):never{http_response_code(404);if($kind==='json'){header('Content-Type: application/json; charset=utf-8');echo '{"error":"not_found"}';}else{header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';}exit;}
function host_ok():bool{$h=strtolower((string)($_SERVER['HTTP_HOST']??''));$h=preg_replace('/:\d+$/','',$h)??$h;return $h==='gamesbehinddoors.de'||$h==='www.gamesbehinddoors.de';}
function origin_ok():bool{$o=strtolower(trim((string)($_SERVER['HTTP_ORIGIN']??'')));return $o==='https://gamesbehinddoors.de'||$o==='https://www.gamesbehinddoors.de';}
function gate_install(string $gateToken):void{
 $root=__DIR__; $ht=$root.'/.htaccess'; $data=$root.'/chatgpt-maintenance/data';
 if(!is_dir($data)&&!@mkdir($data,0700,true)&&!is_dir($data)) throw new RuntimeException('maintenance_data_unavailable');
 $lockPath=$data.'/owner-link-gate.lock'; $lock=@fopen($lockPath,'c+');
 if(!$lock||!flock($lock,LOCK_EX)){if(is_resource($lock))fclose($lock);throw new RuntimeException('gate_lock_failed');}
 try{
  $cur=is_file($ht)?(string)@file_get_contents($ht):''; if(is_file($ht)&&$cur==='')throw new RuntimeException('htaccess_read_failed');
  $b=str_contains($cur,GBD_GATE_BEGIN);$e=str_contains($cur,GBD_GATE_END);if($b xor $e)throw new RuntimeException('gate_marker_mismatch');
  $bak=$data.'/staging-htaccess-before-private-link-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.bak';
  if(@file_put_contents($bak,$cur,LOCK_EX)===false)throw new RuntimeException('backup_failed');@chmod($bak,0600);
  if($b&&$e){$pat='~\R?'.preg_quote(GBD_GATE_BEGIN,'~').'.*?'.preg_quote(GBD_GATE_END,'~').'\R?~s';$base=preg_replace($pat,"\n",$cur,1);if($base===null)throw new RuntimeException('gate_replace_failed');}else{$base=$cur;}
  $gate="\n".GBD_GATE_BEGIN."\n<IfModule mod_rewrite.c>\nRewriteEngine On\n"
       ."RewriteCond %{REQUEST_URI} !^/staging/chatgpt-maintenance(?:/|$) [NC]\n"
       ."RewriteCond %{REQUEST_URI} !^/staging/gbd-storage-test\\.php$ [NC]\n"
       ."RewriteCond %{HTTP:Cookie} !(^|;[[:space:]]*)".GBD_OWNER_COOKIE."=".$gateToken."(;|$) [NC]\n"
       ."RewriteRule ^ - [R=404,L]\n</IfModule>\n"
       ."<IfModule mod_headers.c>\nHeader always set X-Robots-Tag \"noindex, nofollow, noarchive, nosnippet\"\nHeader always set Cache-Control \"no-store\"\n</IfModule>\n".GBD_GATE_END."\n";
  $next=rtrim((string)$base)."\n".$gate;if(@file_put_contents($ht,$next,LOCK_EX)===false)throw new RuntimeException('htaccess_write_failed');
 }finally{flock($lock,LOCK_UN);fclose($lock);@chmod($lockPath,0600);}
}
sec();if(!host_ok())nf();$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
if($method==='POST'){
 if(!origin_ok())nf('json');if((string)($_SERVER['HTTP_X_GBD_PRIVATE_BOOTSTRAP']??'')!=='1')nf('json');
 $ct=strtolower((string)($_SERVER['CONTENT_TYPE']??''));if(!str_starts_with($ct,'application/json'))nf('json');
 $raw=(string)file_get_contents('php://input');if(strlen($raw)>2048)nf('json');$body=json_decode($raw,true);$provided=is_array($body)?(string)($body['token']??''):'';
 if($provided===''||strlen($provided)>256)nf('json');if(!hash_equals(GBD_LINK_TOKEN_SHA256,hash('sha256',$provided)))nf('json');
 try{$gateToken=bin2hex(random_bytes(32));gate_install($gateToken);setcookie(GBD_OWNER_COOKIE,$gateToken,['expires'=>time()+43200,'path'=>'/staging/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);http_response_code(200);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true,'redirect'=>'/staging/admin/private-online-test-20261006/'],JSON_UNESCAPED_SLASHES);exit;}
 catch(Throwable $e){error_log('GBD private bootstrap failed: '.$e->getMessage());http_response_code(503);header('Content-Type: application/json; charset=utf-8');echo '{"error":"private_access_unavailable"}';exit;}
}
if($method!=='GET')nf();http_response_code(404);header('Content-Type: text/html; charset=utf-8');?>
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 Not Found</title><style>body{font-family:system-ui,sans-serif;margin:3rem;line-height:1.45}#m{display:none}</style></head><body><h1>Not Found</h1><p id="p">The requested URL was not found on this server.</p><p id="m">Privater Testzugang wird geöffnet…</p><script>(()=>{const t=location.hash.length>1?location.hash.slice(1):'';if(!t||!/^[A-Za-z0-9_-]{32,256}$/.test(t))return;history.replaceState(null,'',location.pathname);p.style.display='none';m.style.display='block';fetch(location.pathname,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-GBD-Private-Bootstrap':'1'},body:JSON.stringify({token:t})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw 0;location.replace(d.redirect||'/staging/')}).catch(()=>{m.style.display='none';p.style.display='block'})})();</script></body></html>
