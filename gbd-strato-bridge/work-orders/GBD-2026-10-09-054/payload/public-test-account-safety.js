(()=>{
  'use strict';
  const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
  const KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
  const lang=()=>document.documentElement.lang==='en'||new URLSearchParams(location.search).get('lang')==='en'?'en':'de';
  const t=(de,en)=>lang()==='en'?en:de;
  let busy=false;

  async function resendConfirmation(email,box,button){
    if(busy||!email)return;
    busy=true;button.disabled=true;
    try{
      const r=await fetch(PROJECT_URL+'/functions/v1/gbd-resend-confirmation',{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:KEY},
        body:JSON.stringify({email,locale:lang(),context:'public'})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'resend_failed');
      box.textContent=d.message||t('Bestätigungs-E-Mail wurde angefordert.','Confirmation email was requested.');
      box.className='gbd-msg success';
    }catch(_e){
      box.textContent=t('Bestätigungs-E-Mail konnte nicht angefordert werden.','Confirmation email could not be requested.');
      box.className='gbd-msg error';
    }finally{busy=false;button.disabled=false}
  }

  async function applyAccountSafety(){
    const app=document.getElementById('accountApp');
    const deleteButton=document.getElementById('deleteAccount');
    if(!app||!deleteButton)return;

    if(deleteButton.dataset.gbdDeletionGuard!=='1'){
      deleteButton.dataset.gbdDeletionGuard='1';
      deleteButton.disabled=true;
      deleteButton.onclick=null;
      deleteButton.textContent=t('Kontolöschung derzeit deaktiviert','Account deletion currently disabled');
      const note=document.createElement('p');
      note.className='gbd-msg';
      note.textContent=t(
        'Die manuelle Kontolöschung ist während dieses Tests noch nicht freigeschaltet. Testkonten können nach Fertigstellung der Website automatisch gelöscht werden.',
        'Manual account deletion is not enabled during this test. Test accounts may be deleted automatically after the website is completed.'
      );
      deleteButton.insertAdjacentElement('afterend',note);
    }

    const securityCard=deleteButton.closest('.gbd-card');
    if(!securityCard||document.getElementById('gbdEmailConfirmationState'))return;

    const state=document.createElement('div');
    state.id='gbdEmailConfirmationState';
    state.className='gbd-msg';
    securityCard.insertBefore(state,deleteButton);

    try{
      const client=window.__gbdSb;
      const session=client?(await client.auth.getSession()).data.session:null;
      const email=session?.user?.email||'';
      const confirmed=!!session?.user?.email_confirmed_at;
      if(confirmed){
        state.className='gbd-msg success';
        state.textContent=t('E-Mail-Adresse bestätigt.','Email address confirmed.');
        return;
      }
      state.textContent=t('E-Mail-Adresse noch nicht bestätigt.','Email address is not confirmed yet.');
      const resend=document.createElement('button');
      resend.type='button';
      resend.className='button secondary';
      resend.textContent=t('Bestätigungs-E-Mail erneut senden','Resend confirmation email');
      resend.addEventListener('click',()=>resendConfirmation(email,state,resend));
      state.insertAdjacentElement('afterend',resend);
    }catch(_e){
      state.textContent=t('E-Mail-Status konnte nicht geladen werden.','Email status could not be loaded.');
    }
  }

  const observer=new MutationObserver(()=>{applyAccountSafety().catch(()=>{})});
  const start=()=>{
    const app=document.getElementById('accountApp');
    if(!app)return;
    observer.observe(app,{childList:true,subtree:true});
    applyAccountSafety().catch(()=>{});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
