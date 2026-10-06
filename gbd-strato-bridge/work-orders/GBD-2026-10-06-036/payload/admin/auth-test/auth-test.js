const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY=["sb_publish","able_2CqwT","ZnV0S35nNa","KyoEyxw_PS","Tw9_Pk"].join('');
const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY);
const signupClient=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const EU=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const authState=document.getElementById('authState');
const googleState=document.getElementById('googleState');
const googleTest=document.getElementById('googleTest');
const refreshStatus=document.getElementById('refreshStatus');
const form=document.getElementById('registrationTestForm');
const kind=document.getElementById('testKind');
const displayName=document.getElementById('testDisplayName');
const email=document.getElementById('testEmail');
const password=document.getElementById('testPassword');
const country=document.getElementById('testCountry');
const countryConfirm=document.getElementById('testCountryConfirm');
const age=document.getElementById('testAge');
const terms=document.getElementById('testTerms');
const termsLink=document.getElementById('termsLink');
const registerButton=document.getElementById('registerTest');
const registrationState=document.getElementById('registrationState');
const accounts=document.getElementById('testAccounts');
const cleanup=document.getElementById('cleanupTests');
let ownerReady=false;

function msg(el,type,text){el.hidden=false;el.className='form-message '+type;el.textContent=text;}
function populateCountries(){
  const names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['de'],{type:'region'}):null;
  for(const code of EU){const o=document.createElement('option');o.value=code;try{o.textContent=(names?.of(code)||code)+' ('+code+')'}catch{o.textContent=code}country.appendChild(o)}
  country.value='DE';
}
function updateTerms(){
  const developer=kind.value==='developer';
  termsLink.href=developer?'../../legal/developer-terms.html':'../../legal/terms.html';
  termsLink.textContent=developer?'Entwicklerbedingungen':'Nutzungsbedingungen';
}
async function identityStatus(){
  try{
    const {data,error}=await client.auth.getUserIdentities();
    if(error)throw error;
    const providers=(data?.identities||[]).map(x=>x.provider);
    googleState.textContent=providers.includes('google')?'Google ist mit diesem Owner-Konto verbunden.':'Google ist für dieses Owner-Konto noch nicht als Identität verbunden.';
  }catch{googleState.textContent='Google-Identitätsstatus konnte nicht gelesen werden.'}
}
async function loadStatus(){
  ownerReady=false;googleTest.disabled=true;registerButton.disabled=true;cleanup.disabled=true;
  const {data:sessionData}=await client.auth.getSession();
  if(!sessionData?.session){msg(authState,'error','Owner-Login erforderlich. Bitte zuerst im Staging-Adminbereich anmelden.');return;}
  const {data:aalData}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aalData?.currentLevel!=='aal2'){msg(authState,'error','Owner-2FA erforderlich. Bitte im Adminbereich zuerst die MFA-Prüfung abschließen.');await identityStatus();return;}
  const {data,error}=await client.rpc('gbd_private_staging_test_auth_status');
  if(error){msg(authState,'error','Interner Auth-Test nicht freigegeben: '+error.message);return;}
  ownerReady=true;googleTest.disabled=false;registerButton.disabled=false;
  const tests=Array.isArray(data?.tests)?data.tests:[];
  cleanup.disabled=tests.length===0;
  authState.hidden=false;authState.className='form-message success';authState.textContent='Owner + 2FA bestätigt. Private Auth-Tests sind freigegeben.';
  accounts.textContent=tests.length?tests.map(t=>`${t.email} | ${String(t.purpose||'').endsWith('seller')?'Entwickler':'Nutzer'} | E-Mail ${t.emailConfirmed?'bestätigt':'noch nicht bestätigt'}`).join('\n'):'Keine realen Auth-Testkonten vorhanden.';
  accounts.style.whiteSpace='pre-line';
  await identityStatus();
}

googleTest.addEventListener('click',async()=>{
  if(!ownerReady)return;
  googleTest.disabled=true;
  const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/staging/admin/auth-test/',queryParams:{prompt:'select_account'}}});
  if(error){googleTest.disabled=false;msg(authState,'error','Google-Anmeldung konnte nicht gestartet werden: '+error.message);}
});
refreshStatus.addEventListener('click',()=>loadStatus());
kind.addEventListener('change',updateTerms);
form.addEventListener('submit',async e=>{
  e.preventDefault();registrationState.hidden=true;
  if(!ownerReady)return msg(registrationState,'error','Owner + 2FA fehlen.');
  if(!form.checkValidity()){form.reportValidity();return;}
  registerButton.disabled=true;
  try{
    const payload={p_email:email.value.trim(),p_account_kind:kind.value,p_country:country.value,p_locale:'de'};
    const {error:prepareError}=await client.rpc('gbd_private_staging_test_prepare_signup',payload);
    if(prepareError)throw new Error('Vorbereitung fehlgeschlagen: '+prepareError.message);
    const {data:signup,error:signupError}=await signupClient.auth.signUp({
      email:email.value.trim(),password:password.value,
      options:{emailRedirectTo:location.origin+(kind.value==='developer'?'/staging/developers/login/':'/staging/account/'),data:{gbd_account_kind:kind.value,gbd_private_staging_test:'true'}}
    });
    if(signupError)throw new Error('Supabase-Registrierung fehlgeschlagen: '+signupError.message);
    if(!signup?.user?.id)throw new Error('Supabase hat kein Testkonto zurückgegeben.');
    const {error:finalError}=await client.rpc('gbd_private_staging_test_finalize_signup',{p_user_id:signup.user.id,p_account_kind:kind.value,p_display_name:displayName.value.trim(),p_country:country.value,p_locale:'de'});
    if(finalError)throw new Error('Testkonto wurde angelegt, konnte aber nicht markiert werden: '+finalError.message);
    password.value='';
    msg(registrationState,'success','Testkonto angelegt. Supabase Auth hat die Bestätigungs-Mail angefordert. Prüfe Posteingang und Spam. Nach Bestätigung kannst du das Konto im normalen Staging-Login testen.');
    await loadStatus();
  }catch(err){msg(registrationState,'error',err?.message||'Registrierung fehlgeschlagen.');}
  finally{if(ownerReady)registerButton.disabled=false;}
});
cleanup.addEventListener('click',async()=>{
  if(!ownerReady)return;
  if(!confirm('Alle über diesen realen Auth-Test angelegten Konten löschen? Dein Owner-Konto bleibt erhalten.'))return;
  cleanup.disabled=true;
  const {data,error}=await client.rpc('gbd_private_staging_test_cleanup_auth');
  if(error)msg(authState,'error','Testkonten konnten nicht gelöscht werden: '+error.message);
  else msg(authState,'success',`${Number(data?.deleted||0)} reale Auth-Testkonten gelöscht.`);
  await loadStatus();
});
populateCountries();updateTerms();loadStatus();
