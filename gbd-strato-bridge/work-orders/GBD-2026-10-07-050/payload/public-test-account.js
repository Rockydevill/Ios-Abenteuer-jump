const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const COUNTRY_URL='/api/country-check';
const CONFIG_URL='/api/public-config';
const SIGNUP_URL='/api/player-signup';
const ACCOUNT_URL='/api/player-account';
const PASSWORD_RESET_URL='/api/password-reset';

const gate=document.getElementById('countryGate');
const modeSwitch=document.getElementById('accountModeSwitch');
const loginForm=document.getElementById('loginForm');
const registerForm=document.getElementById('registerForm');
const showLogin=document.getElementById('showLogin');
const showRegister=document.getElementById('showRegister');
const message=document.getElementById('message');
const signedIn=document.getElementById('signedIn');
const identity=document.getElementById('identity');
const accountStatus=document.getElementById('accountStatus');
const logoutButton=document.getElementById('logoutButton');
const forgotButton=document.getElementById('forgotButton');
const registerButton=document.getElementById('registerButton');
const loginButton=document.getElementById('loginButton');

let publicTest=false;
let countryAllowed=false;
let client=null;

function showMessage(type,text){
  message.hidden=false;
  message.className='form-message '+type;
  message.textContent=text;
}
function clearMessage(){message.hidden=true;message.textContent='';}
function setMode(mode){
  const register=mode==='register';
  loginForm.hidden=register;
  registerForm.hidden=!register;
  showLogin.className='button '+(register?'secondary':'primary');
  showRegister.className='button '+(register?'primary':'secondary');
  showLogin.setAttribute('aria-pressed',String(!register));
  showRegister.setAttribute('aria-pressed',String(register));
}
function authClient(){
  if(client)return client;
  if(!window.supabase?.createClient)throw new Error('auth_library_unavailable');
  client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
async function loadTestGate(){
  const [countryResponse,configResponse]=await Promise.all([
    fetch(COUNTRY_URL,{headers:{Accept:'application/json'},cache:'no-store'}),
    fetch(CONFIG_URL,{headers:{Accept:'application/json'},cache:'no-store'})
  ]);
  const country=await countryResponse.json().catch(()=>({}));
  const config=await configResponse.json().catch(()=>({}));
  publicTest=configResponse.ok&&config.publicTestMode===true;
  countryAllowed=countryResponse.ok&&country.countryCode==='DE'&&country.accountAllowed===true&&country.publicTestMode===true;
  if(!publicTest||!countryAllowed){
    gate.textContent='Der öffentliche Kontotest ist für deinen aktuellen Zugriff nicht freigeschaltet.';
    gate.className='notice';
    modeSwitch.hidden=true;
    loginForm.hidden=true;
    registerForm.hidden=true;
    return false;
  }
  gate.textContent='Öffentlicher Test aktiv: Deutschland bestätigt. Echtgeld, Downloads und Veröffentlichungen bleiben gesperrt.';
  gate.className='notice';
  return true;
}
async function session(){
  return (await authClient().auth.getSession()).data.session;
}
async function accountApi(body){
  const s=await session();
  if(!s)throw new Error('login_required');
  const r=await fetch(ACCOUNT_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'account_request_failed');
  return d;
}
async function renderSession(){
  if(!publicTest||!countryAllowed)return;
  const s=await session();
  if(!s){
    signedIn.hidden=true;
    modeSwitch.hidden=false;
    setMode('login');
    return;
  }
  try{
    const state=await accountApi({action:'status'});
    loginForm.hidden=true;
    registerForm.hidden=true;
    modeSwitch.hidden=true;
    signedIn.hidden=false;
    identity.textContent=s.user.email||'';
    accountStatus.textContent=state.publicTest===true?'Freigegebenes öffentliches Testkonto. Dieses Konto wird vor dem offiziellen Start gelöscht.':'Testkontostatus bestätigt.';
  }catch{
    await authClient().auth.signOut({scope:'local'}).catch(()=>{});
    signedIn.hidden=true;
    modeSwitch.hidden=false;
    setMode('login');
    showMessage('error','Dieses Konto ist für den öffentlichen Test nicht freigeschaltet.');
  }
}
showLogin?.addEventListener('click',()=>{clearMessage();setMode('login');});
showRegister?.addEventListener('click',()=>{clearMessage();setMode('register');});

loginForm?.addEventListener('submit',async event=>{
  event.preventDefault();clearMessage();
  if(!publicTest||!countryAllowed){showMessage('error','Der öffentliche Test ist für deinen Zugriff nicht freigeschaltet.');return;}
  loginButton.disabled=true;
  try{
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    const {data,error}=await authClient().auth.signInWithPassword({email,password});
    if(error)throw new Error('sign_in_failed');
    if(!data.user?.email_confirmed_at){
      await authClient().auth.signOut({scope:'local'});
      throw new Error('email_not_confirmed');
    }
    await accountApi({action:'status'});
    await renderSession();
  }catch(error){
    await authClient().auth.signOut({scope:'local'}).catch(()=>{});
    const map={
      auth_library_unavailable:'Die sichere Anmeldung konnte nicht geladen werden.',
      email_not_confirmed:'Bitte bestätige zuerst deine E-Mail-Adresse.',
      sign_in_failed:'E-Mail oder Passwort ist nicht korrekt.',
      platform_closed:'Dieses Konto ist nicht für den öffentlichen Test freigeschaltet.',
      account_blocked:'Dieses Konto ist nicht für den öffentlichen Test freigeschaltet.'
    };
    showMessage('error',map[error.message]||'Anmeldung fehlgeschlagen.');
  }finally{loginButton.disabled=false;}
});

registerForm?.addEventListener('submit',async event=>{
  event.preventDefault();clearMessage();
  if(!publicTest||!countryAllowed){showMessage('error','Der öffentliche Test ist für deinen Zugriff nicht freigeschaltet.');return;}
  if(!registerForm.checkValidity()){registerForm.reportValidity();return;}
  const password=document.getElementById('registerPassword').value;
  if(password.length<12){showMessage('error','Das Passwort muss mindestens 12 Zeichen haben.');return;}
  registerButton.disabled=true;
  try{
    const payload={
      displayName:document.getElementById('registerDisplayName').value.trim(),
      email:document.getElementById('registerEmail').value.trim(),
      password,
      declaredCountryCode:'DE',
      countryConfirmed:document.getElementById('countryConfirm').checked,
      ageConfirmed18Plus:document.getElementById('ageConfirm').checked,
      playerTermsAccepted:document.getElementById('termsConfirm').checked,
      locale:'de'
    };
    const r=await fetch(SIGNUP_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'registration_failed');
    document.getElementById('registerPassword').value='';
    showMessage('success',d.message||'Bitte bestätige deine E-Mail-Adresse. Das Testkonto wird vor dem offiziellen Start gelöscht.');
  }catch(error){
    const map={
      registration_email_unavailable:'Die Bestätigungs-E-Mail konnte gerade nicht gesendet werden.',
      country_verification_required:'Deutschland konnte nicht eindeutig bestätigt werden.',
      country_not_supported:'Diese Funktion ist für deinen Staat nicht verfügbar.',
      player_registration_closed:'Die Testregistrierung ist derzeit geschlossen.',
      invalid_registration_data:'Bitte prüfe E-Mail und Passwort.',
      rate_limited:'Zu viele Registrierungsversuche. Bitte später erneut versuchen.'
    };
    showMessage('error',map[error.message]||'Registrierung fehlgeschlagen.');
  }finally{registerButton.disabled=false;}
});

forgotButton?.addEventListener('click',async()=>{
  clearMessage();
  if(!publicTest||!countryAllowed){showMessage('error','Der öffentliche Test ist für deinen Zugriff nicht freigeschaltet.');return;}
  const email=document.getElementById('loginEmail').value.trim();
  if(!email){showMessage('error','Bitte zuerst deine E-Mail-Adresse eingeben.');return;}
  forgotButton.disabled=true;
  try{
    const r=await fetch(PASSWORD_RESET_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,accountKind:'player',locale:'de'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'password_reset_failed');
    showMessage('success',d.message||'Wenn ein Konto zu dieser Adresse existiert, wurde eine Passwort-E-Mail angefordert.');
  }catch(error){
    const map={password_reset_closed:'Passwort-Reset ist derzeit geschlossen.',rate_limited:'Zu viele Anfragen. Bitte später erneut versuchen.',country_not_supported:'Diese Funktion ist für deinen Staat nicht verfügbar.'};
    showMessage('error',map[error.message]||'Passwort-Mail konnte nicht angefordert werden.');
  }finally{forgotButton.disabled=false;}
});

logoutButton?.addEventListener('click',async()=>{
  await authClient().auth.signOut({scope:'local'}).catch(()=>{});
  location.reload();
});

(async()=>{
  try{
    if(!await loadTestGate())return;
    authClient().auth.onAuthStateChange(()=>{setTimeout(()=>renderSession().catch(()=>{}),0);});
    await renderSession();
  }catch{
    gate.textContent='Der öffentliche Kontotest konnte nicht sicher vorbereitet werden.';
    showMessage('error','Bitte später erneut versuchen.');
  }
})();
