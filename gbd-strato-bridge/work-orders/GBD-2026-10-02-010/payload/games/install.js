const BASE='https://voldtqsdqcdexkexwerp.supabase.co';
const KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const button=document.getElementById('liveInstall');
const message=document.getElementById('installMessage');

button?.addEventListener('click',async()=>{
  const slug=button.dataset.slug;
  if(!slug) return;
  if(button.dataset.paid==='true'){
    if(message){
      message.hidden=false;
      message.className='form-message';
      message.textContent='Kauf und Installation sind derzeit noch nicht freigeschaltet.';
    }
    return;
  }
  button.disabled=true;
  try{
    const proxy=(window.location.pathname.indexOf('/staging/')===0?'/staging/_gbd_proxy.php':'/_gbd_proxy.php')+'?service=game_download';
    const r=await fetch(proxy,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:KEY},
      body:JSON.stringify({slug})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      if(d.error==='payment_required'){
        if(message){
          message.hidden=false;
          message.className='form-message error';
          message.textContent='Kauf und Installation sind derzeit noch nicht freigeschaltet.';
        }
        return;
      }
      throw new Error(d.error||'install_failed');
    }
    location.href=d.downloadUrl;
  }catch(error){
    if(message){
      message.hidden=false;
      message.className='form-message error';
      message.textContent='Installation ist derzeit nicht verfügbar.';
    }
  }finally{
    button.disabled=false;
  }
});