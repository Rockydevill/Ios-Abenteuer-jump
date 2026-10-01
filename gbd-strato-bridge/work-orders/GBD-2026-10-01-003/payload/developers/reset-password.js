const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY);

const form=document.getElementById('passwordForm');
const message=document.getElementById('passwordMessage');
const currentRow=document.getElementById('currentPasswordRow');
const currentPassword=document.getElementById('currentPassword');
const newPassword=document.getElementById('newPassword');
const repeat=document.getElementById('newPasswordRepeat');
const intro=document.getElementById('passwordIntro');
const mode=new URLSearchParams(location.search).get('mode');
let recoveryMode=false;

function show(type,text){
  message.hidden=false;
  message.className='form-message '+type;
  message.textContent=text;
}

async function boot(){
  const {data}=await client.auth.getSession();
  if(mode==='change'){
    if(!data.session){
      location.replace('/developers/login/');
      return;
    }
    currentRow.hidden=false;
    currentPassword.required=true;
    intro.textContent='Bestätige dein aktuelles Passwort und wähle ein neues Passwort mit mindestens 12 Zeichen.';
    return;
  }

  if(data.session){
    recoveryMode=true;
    return;
  }

  intro.textContent='Öffne diese Seite über den Link aus deiner Passwort-E-Mail.';
  form.querySelector('button[type="submit"]').disabled=true;
}

client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'||(session&&mode!=='change')){
    recoveryMode=true;
    form.querySelector('button[type="submit"]').disabled=false;
  }
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  message.hidden=true;

  const next=newPassword.value;
  if(next.length<12){
    show('error','Das neue Passwort muss mindestens 12 Zeichen haben.');
    return;
  }
  if(next!==repeat.value){
    show('error','Die beiden neuen Passwörter stimmen nicht überein.');
    return;
  }

  const button=form.querySelector('button[type="submit"]');
  button.disabled=true;

  try{
    const payload={password:next};
    if(mode==='change'){
      payload.currentPassword=currentPassword.value;
    }else if(!recoveryMode){
      throw new Error('Kein gültiger Passwort-Wiederherstellungslink.');
    }

    const {error}=await client.auth.updateUser(payload);
    if(error) throw error;

    newPassword.value='';
    repeat.value='';
    currentPassword.value='';
    show('success','Passwort wurde geändert. Du kannst dich jetzt mit dem neuen Passwort anmelden.');

    if(mode!=='change'){
      await client.auth.signOut({scope:'local'});
      setTimeout(()=>location.replace('/developers/login/'),1400);
    }
  }catch(error){
    show('error','Passwort konnte nicht geändert werden: '+error.message);
  }finally{
    button.disabled=false;
  }
});

boot().catch(()=>show('error','Passwortseite konnte nicht vorbereitet werden.'));