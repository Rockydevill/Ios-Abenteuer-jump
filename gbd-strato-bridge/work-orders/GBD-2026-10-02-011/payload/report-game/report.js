const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const CONFIG_URL=PROJECT_URL+'/functions/v1/gbd-public-config';
const REPORT_URL=PROJECT_URL+'/functions/v1/gbd-game-report';
const lang=document.body.dataset.reportLang==='en'?'en':'de';
const t=(de,en)=>lang==='en'?en:de;
const form=document.getElementById('reportForm');
const closed=document.getElementById('reportClosed');
const msg=document.getElementById('reportMessage');
const btn=document.getElementById('reportSubmit');
const slugEl=document.getElementById('gameSlug');
const categoryEl=document.getElementById('reportCategory');
const params=new URLSearchParams(location.search);
const slug=String(params.get('game')||'').trim();
const category=String(params.get('category')||'').trim();
slugEl.value=slug;
if([...categoryEl.options].some(o=>o.value===category)) categoryEl.value=category;
function show(type,text){msg.hidden=false;msg.className='form-message '+type;msg.textContent=text}
async function load(){
  const r=await fetch(CONFIG_URL,{headers:{apikey:PUBLISHABLE_KEY},cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  const enabled=r.ok&&d.platformPublic===true&&d.gameIssueReportsEnabled===true&&Boolean(slug);
  form.hidden=!enabled;
  closed.hidden=enabled;
}
form?.addEventListener('submit',async e=>{
  e.preventDefault();msg.hidden=true;
  if(!form.checkValidity()){form.reportValidity();return}
  btn.disabled=true;
  try{
    const r=await fetch(REPORT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY},
      body:JSON.stringify({
        gameSlug:slugEl.value.trim(),
        category:categoryEl.value,
        email:document.getElementById('reportEmail').value.trim(),
        description:document.getElementById('reportDescription').value.trim(),
        sourcePage:document.referrer||location.href
      })
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'report_failed');
    form.reset();slugEl.value=slug;
    show('success',t('Meldung gespeichert. Referenz: ','Report stored. Reference: ')+(d.reportCode||''));
  }catch(e){
    const m={
      reports_closed:t('Das Meldeformular ist derzeit geschlossen.','The report form is currently closed.'),
      platform_closed:t('Die Plattform ist derzeit geschlossen.','The platform is currently closed.'),
      rate_limited:t('Zu viele Meldungen. Bitte später erneut versuchen.','Too many reports. Please try again later.'),
      game_not_found:t('Das Spiel wurde nicht gefunden.','The game was not found.')
    };
    show('error',m[e.message]||t('Meldung konnte nicht gesendet werden.','The report could not be sent.'));
  }finally{btn.disabled=false}
});
load().catch(()=>{form.hidden=true;closed.hidden=false});