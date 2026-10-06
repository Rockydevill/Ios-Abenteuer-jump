const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY);
const button=document.getElementById('googleAdminLogin');
const message=document.getElementById('googleAdminMessage');
function show(type,text){message.hidden=false;message.className='form-message '+type;message.textContent=text}
(async()=>{const {data}=await client.auth.getSession();if(data.session)location.replace('/staging/admin/');})();
button?.addEventListener('click',async()=>{message.hidden=true;button.disabled=true;try{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/staging/admin/',queryParams:{prompt:'select_account'}}});if(error)throw error}catch(e){button.disabled=false;show('error','Google-Anmeldung konnte nicht gestartet werden: '+(e?.message||'unbekannter Fehler'));}});