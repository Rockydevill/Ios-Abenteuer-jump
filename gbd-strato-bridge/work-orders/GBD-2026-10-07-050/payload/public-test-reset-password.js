const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const COUNTRY_URL='/api/country-check';
const CONFIG_URL='/api/public-config';
const ACCOUNT_URL='/api/player-account';

const form=document.getElementById('passwordForm');
const message=document.getElementById('passwordMessage');
const currentRow=document.getElementById('currentPasswordRow');
const currentPassword=document.getElementById('currentPassword');
const newPassword=document.getElementById('newPassword');
const repeat=document.getElementById('newPasswordRepeat');
const intro=document.getElementById('passwordIntro');
const submit=document.getElementById('passwordSubmit');
const mode=new URLSearchParams(location.search).get('mode');
let client=null;
let publicTest=false;
let countryAllowed=false;
let recoveryMode=false;

function show(type,text){message.hidden=false;message.className='form-message '+type;message.textContent=text;}
function authClient(){
  if(client)return client;
  if(!window.supabase?.createClient)throw new Error('auth_library_unavailable');
  client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
async function loadGate(){
  const [cr,pr]=await Promise.all([fetch(COUNTRY_URL,{headers:{Accept:'application/json'},cache:'no-store'}),fetch(CONFIG_URL,{headers:{Accept:'application/json'},cache:'no-store'})]);
  const c=await cr.json().catch(()=>({})),p=await pr.json().catch(()=>({}));
  publicTest=pr.ok&&p.publicTestMode===true;
  countryAllowed=cr.ok&&c.countryCode==='DE'&&c.accountAllowed===true&&c.publicTestMode===true;
  return publicTest&&countryAllowed;
}
async function getSession(){return (await authClient().auth.getSession()).data.session;}
async function assertTestAccount(){
  const s=await getSession();if(!s)throw new Error('login_required');
  const r=await fetch(ACCOUNT_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:'status'})});
  const d=await r.json().catch(()=>({}));if(!r.ok||d.publicTest!==true)throw new Error('test_account_required');return s;
}
async function boot(){
  submit.disabled=true;
  if(!await loadGate()){intro.textContent='Der öffentliche Kontotest ist für deinen aktuellen Zugriff nicht freigeschaltet.';return;}
  const auth=authClient();
  auth.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){recoveryMode=true;submit.disabled=false;}});
  const s=await getSession();
  if(mode==='change'){
    if(!s){location.replace('/account/');return;}
    await assertTestAccount();
    currentRow.hidden=false;currentPassword.required=true;
    intro.textContent='Bestätige dein aktuelles Passwort und wähle ein neues Passwort mit mindestens 12 Zeichen.';
    submit.disabled=false;return;
  }
  if(s){
    try{await assertTestAccount();recoveryMode=true;submit.disabled=false;intro.textContent='Wähle ein neues Passwort mit mindestens 12 Zeichen.';return;}catch{}
  }
  intro.textContent='Öffne diese Seite über den Link aus deiner Passwort-E-Mail.';
}
form?.addEventListener('submit',async event=>{
  event.preventDefault();message.hidden=true;
  if(!publicTest||!countryAllowed){show('error','Der öffentliche Test ist für deinen Zugriff nicht freigeschaltet.');return;}
  const next=newPassword.value;
  if(next.length<12){show('error','Das neue Passwort muss mindestens 12 Zeichen haben.');return;}
  if(next!==repeat.value){show('error','Die beiden neuen Passwörter stimmen nicht überein.');return;}
  submit.disabled=true;
  try{
    const auth=authClient();
    const s=await assertTestAccount();
    if(mode==='change'){
      const email=s.user?.email||'';if(!email)throw new Error('login_required');
      const {error}=await auth.auth.signInWithPassword({email,password:currentPassword.value});
      if(error)throw new Error('current_password_invalid');
      await assertTestAccount();
    }else if(!recoveryMode){throw new Error('invalid_recovery_link');}
    const {error}=await auth.auth.updateUser({password:next});if(error)throw error;
    newPassword.value='';repeat.value='';currentPassword.value='';
    show('success','Passwort wurde geändert.');
    if(mode!=='change'){await auth.auth.signOut({scope:'local'});setTimeout(()=>location.replace('/account/'),1400);}
  }catch(error){
    const map={
      auth_library_unavailable:'Die sichere Passwortfunktion konnte nicht geladen werden.',
      current_password_invalid:'Das aktuelle Passwort ist nicht korrekt.',
      login_required:'Bitte melde dich erneut an.',
      invalid_recovery_link:'Kein gültiger Passwort-Wiederherstellungslink.',
      test_account_required:'Dieses Konto ist nicht für den öffentlichen Test freigeschaltet.'
    };
    show('error',map[error.message]||'Passwort konnte nicht geändert werden.');
  }finally{if(publicTest&&countryAllowed)submit.disabled=false;}
});
boot().catch(()=>show('error','Passwortseite konnte nicht sicher vorbereitet werden.'));
