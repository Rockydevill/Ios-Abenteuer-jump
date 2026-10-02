const GBD_BASE='https://voldtqsdqcdexkexwerp.supabase.co';
const GBD_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const GBD_LANG=(document.documentElement.lang||'de').toLowerCase().startsWith('en')?'en':'de';

function publicFeatures(value){
  return String(value||'').split(',').map(x=>x.trim()).filter(Boolean)
    .filter(x=>!/(shop|in[- ]?game[- ]?käuf|ingame[- ]?käuf|paypal|münzpaket|kauf|purchase)/i.test(x))
    .slice(0,6);
}
function safe(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function safeAttr(v){return safe(v)}
function gameUrl(slug){
  return (GBD_LANG==='en'?'/en/games/':'/games/')+encodeURIComponent(slug)+'/';
}

function renderPublishedGames(games){
  const grid=document.getElementById('catalogGrid');
  if(!grid) return;
  grid.innerHTML='';

  for(const g of games||[]){
    if(!g.titleImageUrl||!g.appLogoUrl) continue;

    const card=document.createElement('article');
    card.className='catalog-card';
    card.dataset.gameCard='';
    card.dataset.search=(g.gameName+' '+g.developerName+' '+g.genre+' '+(g.features||'')).toLowerCase();
    card.dataset.categories=(g.genre||'').toLowerCase();

    const details=gameUrl(g.slug);
    const features=publicFeatures(g.features);
    const verified=GBD_LANG==='en'?'Reviewed by us':'Von uns geprüft';
    const coverAlt=(GBD_LANG==='en'?'Cover image of ':'Titelbild von ')+g.gameName;
    const logoAlt=(GBD_LANG==='en'?'App logo of ':'App-Logo von ')+g.gameName;
    const platformLabel='ANDROID';

    card.innerHTML=
      '<a class="catalog-media" href="'+details+'">'+
        '<img class="catalog-cover-image" src="'+safeAttr(g.titleImageUrl)+'" width="1280" height="720" loading="lazy" decoding="async" alt="'+safeAttr(coverAlt)+'">'+
        '<span class="verified-badge">✓ '+safe(verified)+'</span>'+
        '<span class="catalog-status">'+safe(platformLabel)+'</span>'+
      '</a>'+
      '<div class="catalog-body">'+
        '<div class="catalog-game-identity">'+
          '<img class="catalog-app-logo" src="'+safeAttr(g.appLogoUrl)+'" width="96" height="96" loading="lazy" decoding="async" alt="'+safeAttr(logoAlt)+'">'+
          '<div><h3>'+safe(g.gameName)+'</h3><p>'+(GBD_LANG==='en'?'by ':'von ')+safe(g.developerName)+'</p></div>'+
        '</div>'+
        '<p class="catalog-description">'+safe(g.shortDescription || g.description)+'</p>'+
        '<div class="catalog-tags">'+features.map(x=>'<span>'+safe(x)+'</span>').join('')+'</div>'+
        '<div class="catalog-info-grid">'+
          '<span><small>Android</small><b>'+safe(g.minAndroid||'–')+'</b></span>'+
          '<span><small>'+safe(GBD_LANG==='en'?'Genre':'Genre')+'</small><b>'+safe(g.genre)+'</b></span>'+
          '<span><small>'+safe(GBD_LANG==='en'?'Status':'Status')+'</small><b>'+safe(verified)+'</b></span>'+
        '</div>'+
        '<div class="catalog-actions">'+
          '<a class="button secondary" href="'+details+'">'+(GBD_LANG==='en'?'View details':'Details ansehen')+'</a>'+
        '</div>'+
      '</div>';

    grid.appendChild(card);
  }

  window.dispatchEvent(new Event('gbd-catalog-updated'));
}

async function loadPublishedGames(){
  try{
    const r=await fetch(GBD_BASE+'/functions/v1/gbd-public-games?lang='+encodeURIComponent(GBD_LANG),{headers:{apikey:GBD_KEY}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'catalog_unavailable');
    renderPublishedGames(d.games||[]);
  }catch(e){
    console.warn('Live-Katalog konnte nicht geladen werden',e);
    renderPublishedGames([]);
  }
}


loadPublishedGames();