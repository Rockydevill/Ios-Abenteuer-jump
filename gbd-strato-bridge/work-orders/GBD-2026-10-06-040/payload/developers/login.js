(()=>{'use strict';
const SUPABASE_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const SUPABASE_KEY=['sb_publish','able_2CqwT','ZnV0S35nNa','KyoEyxw_PS','Tw9_Pk'].join('');
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const PRIVATE_AUTH='/staging/_gbd_proxy.php?service=private_staging_auth';
const LOGIN='/staging/developers/login/';
const PORTAL='/staging/developers/portal/';
const EU=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const $=id=>document.getElementById(id);
let oauthFinalizeBusy=false;

function show(ok,text){const el=$('pageMessage');el.classList.remove('hidden','ok','bad');el.classList.add(ok?'ok':'bad');el.textContent=text;}
function clearMessage(){$('pageMessage').classList.add('hidden');$('pageMessage').textContent='';}
function human(code){
  const m={
    smtp_not_configured:'STRATO-Mail ist noch nicht eingerichtet. Richte zuerst im privaten Online-Testbereich eine STRATO-Mailbox ein.',
    registration_email_unavailable:'Die Registrierungs-Mail konnte über STRATO nicht versendet werden. Das angelegte Testkonto wurde wieder entfernt.',
    email_already_registered:'Diese E-Mail-Adresse ist bereits registriert.',
    admin_role_must_remain_separate:'Die Admin-E-Mail darf nicht als Entwickler-Testkonto verwendet werden.',
    country_not_supported:'Dieser Test ist nur aus einem EU27-Land und mit einem EU27-Land im Formular erlaubt.',
    invalid_registration_data:'Bitte prüfe Benutzername, E-Mail, Passwort und Land.',
    age_18_confirmation_required:'Die 18+-Bestätigung fehlt.',
    country_confirmation_required:'Die Länderbestätigung fehlt.',
    developer_terms_required:'Die Entwickler-Testbedingungen müssen bestätigt werden.',
    signup_link_failed:'Der sichere Bestätigungslink konnte nicht erzeugt werden.',
    google_registration_details_required:'Für diese Google-Adresse existiert noch kein Entwicklerkonto. Bitte die Registrierungsdaten ausfüllen und „Mit Google registrieren“ wählen.',
    google_oauth_preapproval_required:'Die private Google-Freigabe fehlt oder ist abgelaufen. Starte Google erneut über diese Seite.',
    google_oauth_email_mismatch:'Das ausgewählte Google-Konto stimmt nicht mit der zuvor freigegebenen E-Mail überein.',
    trusted_staging_proxy_required:'Der private Staging-Authentifizierungspfad wurde nicht erkannt.',
    sandbox_only_required:'Sicherheitsstopp: PayPal muss für diesen Test auf Sandbox stehen.',
    private_staging_test_closed:'Der private Staging-Test ist derzeit geschlossen.',
    legal_document_snapshot_missing:'Die interne Testfassung der Entwicklerbedingungen fehlt im Backend.',
    server_error:'Backend-Fehler. Öffentliche Registrierung und PayPal LIVE wurden nicht geöffnet.'
  };
  return m[code]||code||'Unbekannter Fehler';
}
async function privateCall(body,accessToken=''){
  const headers={'Content-Type':'application/json'};
  if(accessToken)headers.Authorization='Bearer '+accessToken;
  const r=await fetch(PRIVATE_AUTH,{method:'POST',credentials:'same-origin',cache:'no-store',headers,body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||('HTTP '+r.status));e.status=r.status;throw e;}
  return d;
}
function setMode(mode){
  const reg=mode==='register';
  $('loginCard').classList.toggle('hidden',reg);$('registerCard').classList.toggle('hidden',!reg);
  $('tabLogin').classList.toggle('active',!reg);$('tabLogin').classList.toggle('secondary',reg);
  $('tabRegister').classList.toggle('active',reg);$('tabRegister').classList.toggle('secondary',!reg);
  clearMessage();
}
function countries(){
  const names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['de'],{type:'region'}):null;
  for(const c of EU){const o=document.createElement('option');o.value=c;o.textContent=(names?.of(c)||c)+' ('+c+')';$('regCountry').appendChild(o);}
  $('regCountry').value='DE';
}
function regPayload(){return {
  username:$('regUsername').value.trim(),email:$('regEmail').value.trim().toLowerCase(),password:$('regPassword').value,
  declaredCountryCode:$('regCountry').value,locale:'de',ageConfirmed18Plus:$('regAge').checked,
  countryConfirmed:$('regCountryConfirm').checked,developerTermsAccepted:$('regTerms').checked
};}
function validateRegistration(){if(!$('registerForm').checkValidity()){$('registerForm').reportValidity();return false;}return true;}
async function startGoogle(email){
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+LOGIN,queryParams:{prompt:'select_account',login_hint:email}}});
  if(error)throw error;
  if(data?.url){location.assign(data.url);return;}
  throw new Error('Google-Anmeldung konnte nicht gestartet werden.');
}
async function finalizeOAuthSession(session){
  if(oauthFinalizeBusy||!session?.access_token)return;
  oauthFinalizeBusy=true;
  try{
    const d=await privateCall({action:'google_finalize',locale:'de'},session.access_token);
    if(d?.ok===true){location.replace(PORTAL);return;}
  }catch(e){
    await client.auth.signOut().catch(()=>{});
    show(false,human(e.message));
  }finally{oauthFinalizeBusy=false;}
}
async function initialSession(){
  const qs=new URLSearchParams(location.search);const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const oauthErr=qs.get('error_description')||hash.get('error_description')||qs.get('error')||hash.get('error');
  if(oauthErr){show(false,'Google-Anmeldung fehlgeschlagen: '+oauthErr);history.replaceState(null,'',LOGIN);}
  const {data,error}=await client.auth.getSession();if(error){show(false,error.message);return;}
  if(data?.session){
    const kind=String(data.session.user?.user_metadata?.gbd_account_kind||'').toLowerCase();
    if(kind==='developer') await finalizeOAuthSession(data.session);
  }
}

$('tabLogin').addEventListener('click',()=>setMode('login'));
$('tabRegister').addEventListener('click',()=>setMode('register'));

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();clearMessage();const b=$('loginSubmit');b.disabled=true;
  try{
    const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
    const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
    if(!data?.user?.email_confirmed_at){await client.auth.signOut();throw new Error('E-Mail ist noch nicht bestätigt. Nutze „Bestätigungs-Mail erneut senden“.');}
    location.replace(PORTAL);
  }catch(x){show(false,human(x.message));}finally{$('loginPassword').value='';b.disabled=false;}
});

$('googleLogin').addEventListener('click',async()=>{
  clearMessage();const b=$('googleLogin');b.disabled=true;
  try{
    const email=$('loginEmail').value.trim().toLowerCase();if(!email){$('loginEmail').focus();throw new Error('Bitte zuerst deine Google-E-Mail-Adresse eingeben.');}
    const d=await privateCall({action:'google_login_prepare',email,locale:'de'});
    if(d?.existing!==true)throw new Error('google_registration_details_required');
    await startGoogle(email);
  }catch(x){
    if(x.message==='google_registration_details_required'){$('regEmail').value=$('loginEmail').value.trim().toLowerCase();setMode('register');show(false,human(x.message));}
    else show(false,human(x.message));
    b.disabled=false;
  }
});

$('registerForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!validateRegistration())return;clearMessage();const b=$('registerSubmit');b.disabled=true;
  try{
    const p=regPayload();const d=await privateCall({action:'register',...p});$('regPassword').value='';
    show(true,'Registrierung angelegt. Die Bestätigungs-Mail wurde über STRATO an '+(d.email||p.email)+' versendet. Nach der Bestätigung kannst du dich hier anmelden.');
    $('loginEmail').value=p.email;$('resendEmail').value=p.email;$('resetEmail').value=p.email;
  }catch(x){$('regPassword').value='';show(false,human(x.message));}finally{b.disabled=false;}
});

$('googleRegister').addEventListener('click',async()=>{
  if(!validateRegistration())return;clearMessage();const b=$('googleRegister');b.disabled=true;
  try{
    const p=regPayload();delete p.password;
    const d=await privateCall({action:'google_prepare',...p});
    if(d?.existing===true){show(true,'Für diese E-Mail existiert bereits ein Entwicklerkonto. Google-Anmeldung wird gestartet.');}
    await startGoogle(p.email);
  }catch(x){show(false,human(x.message));b.disabled=false;}
});

$('resetForm').addEventListener('submit',async e=>{
  e.preventDefault();clearMessage();const b=$('resetSubmit');b.disabled=true;
  try{const email=$('resetEmail').value.trim().toLowerCase();const d=await privateCall({action:'password_reset',email,locale:'de'});show(true,d.message||'Wenn ein Konto existiert, wurde eine Passwort-E-Mail angefordert.');}
  catch(x){show(false,human(x.message));}finally{b.disabled=false;}
});

$('resendForm').addEventListener('submit',async e=>{
  e.preventDefault();clearMessage();const b=$('resendSubmit');b.disabled=true;
  try{const email=$('resendEmail').value.trim().toLowerCase();const d=await privateCall({action:'resend_confirmation',email,locale:'de'});show(true,d.message||'Wenn die Adresse noch bestätigt werden muss, wurde eine Bestätigungs-Mail angefordert.');}
  catch(x){show(false,human(x.message));}finally{b.disabled=false;}
});

countries();setMode('login');initialSession();
})();
