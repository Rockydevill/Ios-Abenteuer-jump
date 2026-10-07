const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const CONFIG_URL=PROJECT_URL+'/functions/v1/gbd-public-config';
const IS_STAGING=window.location.pathname.indexOf('/staging/')===0;
const SERVICE_PROXY_URL=(IS_STAGING?'/staging/_gbd_proxy.php':'/_gbd_proxy.php');
const SUPPORT_URL=SERVICE_PROXY_URL+'?service=support';
const client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY);
const lang=document.body.dataset.supportLang==='en'?'en':'de';
const t=(de,en)=>lang==='en'?en:de;
const form=document.getElementById('supportForm'),closed=document.getElementById('supportClosed'),message=document.getElementById('supportMessage'),button=document.getElementById('supportSubmit');
function show(type,text){message.hidden=false;message.className='form-message '+type;message.textContent=text}
async function load(){const r=await fetch(CONFIG_URL,{headers:{apikey:PUBLISHABLE_KEY},cache:'no-store'});const d=await r.json().catch(()=>({}));const enabled=r.ok&&d.supportRequestsEnabled===true;form.hidden=!enabled;closed.hidden=enabled}
form?.addEventListener('submit',async e=>{
  e.preventDefault();message.hidden=true;if(!form.checkValidity()){form.reportValidity();return}button.disabled=true;
  try{
    const s=(await client.auth.getSession()).data.session;
    const headers={'Content-Type':'application/json',apikey:PUBLISHABLE_KEY};if(s)headers.Authorization='Bearer '+s.access_token;
    const payload={
      category:document.getElementById('supportCategory').value,
      email:document.getElementById('supportEmail').value.trim(),
      subject:document.getElementById('supportSubject').value.trim(),
      message:document.getElementById('supportMessageText').value.trim(),
      privateStagingTest:IS_STAGING
    };
    const r=await fetch(SUPPORT_URL,{method:'POST',credentials:'same-origin',cache:'no-store',headers,body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'support_failed');
    form.reset();
    const ref=d.ticketReference||d.requestId||'';
    show('success',t('Supportanfrage wurde gespeichert. Referenz: ','Support request stored. Reference: ')+ref);
  }catch(e){
    const m={
      support_closed:t('Das Supportformular ist derzeit geschlossen.','The support form is currently closed.'),
      rate_limited:t('Zu viele Anfragen. Bitte später erneut versuchen.','Too many requests. Please try again later.'),
      identity_documents_not_allowed_by_email_support:t('Ausweisdokumente dürfen nicht über normalen Support gesendet werden.','Identity documents must not be sent through ordinary support.'),
      identity_documents_not_allowed_in_support:t('Ausweisdokumente dürfen nicht über normalen Support gesendet werden.','Identity documents must not be sent through ordinary support.'),
      country_not_supported:t('Der Supportzugriff wurde für diesen Standort nicht freigegeben.','Support access is not enabled for this location.'),
      trusted_proxy_required:t('Der sichere Website-Zugriff wurde nicht erkannt. Öffne den Support erneut über die private Website.','The secure website path was not recognized. Reopen support through the private site.'),
      platform_closed:t('Die Plattform ist außerhalb des privaten Tests geschlossen.','The platform is closed outside the private test.'),
      server_error:t('Der Supportdienst hatte einen Backend-Fehler.','The support service had a backend error.')
    };
    show('error',m[e.message]||t('Supportanfrage konnte nicht gesendet werden.','Support request could not be sent.'));
  }finally{button.disabled=false}
});
load().catch(()=>{form.hidden=true;closed.hidden=false});
