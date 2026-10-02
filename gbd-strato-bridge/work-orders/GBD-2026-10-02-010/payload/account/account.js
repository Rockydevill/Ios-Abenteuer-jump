const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const PUBLIC_CONFIG_URL=PROJECT_URL+'/functions/v1/gbd-public-config';
const SIGNUP_URL=PROJECT_URL+'/functions/v1/gbd-player-signup';
const ACCOUNT_URL=PROJECT_URL+'/functions/v1/gbd-player-account';
const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY);
const lang=document.body.dataset.accountLang==='en'?'en':'de';
const t=(de,en)=>lang==='en'?en:de;
const closed=document.getElementById('playerAccountClosed');
const loginForm=document.getElementById('playerLoginForm');
const regForm=document.getElementById('playerRegistrationForm');
const msg=document.getElementById('playerAccountMessage');
const signed=document.getElementById('playerSignedIn');
const identity=document.getElementById('playerIdentity');
const countryStatus=document.getElementById('playerCountryStatus');
const logout=document.getElementById('playerLogout');
const deleteButton=document.getElementById('playerDeleteRequest');
const country=document.getElementById('playerRegisterCountry');
const receiptSection=document.getElementById('playerReceiptSection');
const receiptWrap=document.getElementById('playerReceipts');
const EU=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
function show(type,text){msg.hidden=false;msg.className='form-message '+type;msg.textContent=text}
function fillCountries(){
  if(!country||country.options.length>1)return;
  const names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames([lang],{type:'region'}):null;
  for(const code of EU){const o=document.createElement('option');o.value=code;let n=code;try{n=names?.of(code)||code}catch{}o.textContent=n+' ('+code+')';country.appendChild(o)}
}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function money(cents,currency='EUR'){try{return new Intl.NumberFormat(lang==='en'?'en-GB':'de-DE',{style:'currency',currency}).format(Number(cents||0)/100)}catch{return (Number(cents||0)/100).toFixed(2)+' '+currency}}
function fmtDate(value){try{return new Intl.DateTimeFormat(lang==='en'?'en-GB':'de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value||'')}}
function renderReceipts(items){
  if(!receiptSection||!receiptWrap)return;
  receiptSection.hidden=false;
  if(!items?.length){
    receiptWrap.innerHTML='<div class="notice">'+esc(t('Noch keine Kaufbestätigungen vorhanden.','No purchase confirmations yet.'))+'</div>';
    return;
  }
  receiptWrap.innerHTML=items.map(r=>{
    const seller=r.seller||{};
    const sellerName=seller.business_name||seller.legal_name||seller.display_name||t('Verkäuferangabe nicht verfügbar','Seller information unavailable');
    return '<article class="developer-status-card" style="margin-top:12px">'+
      '<div><span class="status-pill approved">'+esc(r.receiptCode||'')+'</span><h3>'+esc(r.itemTitle||'')+'</h3>'+
      '<p>'+esc(money(r.amount?.cents,r.amount?.currency||'EUR'))+' · '+esc(fmtDate(r.createdAt))+'</p></div>'+
      '<div class="developer-status-meta">'+
      '<span><small>'+esc(t('Verkäufer','Seller'))+'</small><b>'+esc(sellerName)+'</b></span>'+
      '<span><small>'+esc(t('Bereitstellung','Delivery'))+'</small><b>'+esc(r.immediateSupplyRequested?t('sofort angefordert','immediate requested'):t('normal','standard'))+'</b></span>'+
      '<span><small>'+esc(t('E-Mail-Status','Email status'))+'</small><b>'+esc(r.emailDeliveryStatus||'not_configured')+'</b></span>'+
      '</div></article>';
  }).join('');
}
async function activeSession(){return (await client.auth.getSession()).data.session}
async function accountApi(body){
  const s=await activeSession();if(!s)throw new Error('login_required');
  const r=await fetch(ACCOUNT_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d
}
async function loadConfig(){
  const r=await fetch(PUBLIC_CONFIG_URL,{headers:{apikey:PUBLISHABLE_KEY},cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return;
  const s=await activeSession();
  if(s){
    loginForm.hidden=true;regForm.hidden=true;
    try{
      const state=await accountApi({action:'status'});
      signed.hidden=false;closed.hidden=true;identity.textContent=s.user.email||'';countryStatus.textContent=t('Landstatus: ','Country status: ')+(state.profile?.countryStatus||'unknown');
      try{const receiptData=await accountApi({action:'receipts'});renderReceipts(receiptData.receipts||[])}catch{if(receiptSection)receiptSection.hidden=true}
    }
    catch(e){signed.hidden=true;closed.hidden=false;closed.textContent=e.message==='player_accounts_closed'?t('Nutzerkonten sind derzeit noch nicht freigeschaltet.','User accounts are not enabled yet.'):t('Dieses Konto kann für die funktionalen Dienste derzeit nicht genutzt werden.','This account cannot currently use functional services.')}
    return;
  }
  loginForm.hidden=d.playerAccountsEnabled!==true;
  regForm.hidden=d.playerRegistrationEnabled!==true;
  closed.hidden=d.playerAccountsEnabled===true||d.playerRegistrationEnabled===true;
  fillCountries();
}
loginForm?.addEventListener('submit',async e=>{e.preventDefault();msg.hidden=true;const email=document.getElementById('playerLoginEmail').value.trim();const password=document.getElementById('playerLoginPassword').value;const {data,error}=await client.auth.signInWithPassword({email,password});if(error){show('error',t('Anmeldung fehlgeschlagen.','Sign-in failed.'));return}if(!data.user?.email_confirmed_at){await client.auth.signOut({scope:'local'});show('error',t('Bitte bestätige zuerst deine E-Mail-Adresse.','Please confirm your email address first.'));return}await loadConfig()});
regForm?.addEventListener('submit',async e=>{e.preventDefault();msg.hidden=true;if(!regForm.checkValidity()){regForm.reportValidity();return}const button=document.getElementById('playerRegisterButton');button.disabled=true;try{const r=await fetch(SIGNUP_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY},body:JSON.stringify({displayName:document.getElementById('playerRegisterDisplayName').value.trim(),email:document.getElementById('playerRegisterEmail').value.trim(),password:document.getElementById('playerRegisterPassword').value,declaredCountryCode:country.value,countryConfirmed:document.getElementById('playerRegisterCountryConfirm').checked,playerTermsAccepted:document.getElementById('playerRegisterTerms').checked})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'registration_failed');document.getElementById('playerRegisterPassword').value='';show('success',d.message||t('Bitte bestätige deine E-Mail-Adresse.','Please confirm your email address.'))}catch(e){const m={country_not_supported:t('Für deinen Staat ist diese Funktion nicht verfügbar.','This feature is not available in your country.'),country_verification_required:t('Dein Land konnte nicht eindeutig bestätigt werden.','Your country could not be confirmed.'),player_registration_closed:t('Nutzerregistrierung ist derzeit geschlossen.','User registration is currently closed.'),rate_limited:t('Zu viele Versuche. Bitte später erneut versuchen.','Too many attempts. Please try again later.')} ;show('error',m[e.message]||t('Registrierung fehlgeschlagen.','Registration failed.'))}finally{button.disabled=false}});
logout?.addEventListener('click',async()=>{await client.auth.signOut({scope:'local'});location.reload()});
deleteButton?.addEventListener('click',async()=>{if(!confirm(t('Kontolöschung anfordern? Rechtlich notwendige Transaktionsnachweise werden getrennt behandelt.','Request account deletion? Legally required transaction evidence is handled separately.')))return;try{await accountApi({action:'request_delete'});show('success',t('Kontolöschung wurde angefordert.','Account deletion has been requested.'));deleteButton.disabled=true}catch(e){show('error',e.message==='account_deletion_closed'?t('Kontolöschung ist derzeit noch nicht freigeschaltet.','Account deletion is not enabled yet.'):e.message)}});
client.auth.onAuthStateChange(()=>loadConfig());
loadConfig().catch(()=>show('error',t('Kontostatus konnte nicht geladen werden.','Account status could not be loaded.')));