const menuButton=document.getElementById('menuButton');
const mainNav=document.getElementById('mainNav');
const lang=(document.documentElement.lang||'de').toLowerCase().startsWith('en')?'en':'de';

if(menuButton&&mainNav){
  menuButton.addEventListener('click',()=>{
    const open=mainNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.setAttribute('aria-label',open?(lang==='en'?'Close menu':'Menü schließen'):(lang==='en'?'Open menu':'Menü öffnen'));
  });
  mainNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    mainNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label',lang==='en'?'Open menu':'Menü öffnen');
  }));
}

const gameSearch=document.getElementById('gameSearch');
const clearSearch=document.getElementById('clearSearch');
const chips=[...document.querySelectorAll('.category-chip')];
const resultCount=document.getElementById('resultCount');
const emptySearch=document.getElementById('emptySearch');
const publicGameFact=document.getElementById('publicGameFact');
let activeFilter='all';

function normalize(value){
  return String(value||'').toLocaleLowerCase(lang==='en'?'en-US':'de-DE').trim();
}
function cards(){return [...document.querySelectorAll('[data-game-card]')];}

function updateCatalog(){
  const query=normalize(gameSearch?.value);
  let visible=0;
  cards().forEach(card=>{
    const haystack=normalize(card.dataset.search);
    const categories=(card.dataset.categories||'').split(/\s+/);
    const show=(!query||haystack.includes(query))&&(activeFilter==='all'||categories.includes(activeFilter));
    card.hidden=!show;
    if(show) visible++;
  });

  if(resultCount){
    resultCount.textContent=lang==='en'
      ? (visible===1?'1 game':visible+' games')
      : (visible===1?'1 Spiel':visible+' Spiele');
  }
  if(publicGameFact) publicGameFact.textContent=String(cards().length);

  if(emptySearch){
    emptySearch.hidden=visible!==0;
    const h=emptySearch.querySelector('h3');
    const p=emptySearch.querySelector('p');
    if(h) h.textContent=query
      ? (lang==='en'?'No game found':'Kein Spiel gefunden')
      : (lang==='en'?'No approved games yet':'Noch keine freigegebenen Spiele');
    if(p) p.textContent=query
      ? (lang==='en'?'Try a different search term.':'Versuche einen anderen Suchbegriff.')
      : (lang==='en'?'Approved games will appear here after review.':'Sobald ein Spiel geprüft und freigegeben wurde, erscheint es hier.');
  }
}

gameSearch?.addEventListener('input',updateCatalog);
clearSearch?.addEventListener('click',()=>{
  if(gameSearch){gameSearch.value='';gameSearch.focus();}
  updateCatalog();
});
chips.forEach(chip=>chip.addEventListener('click',()=>{
  chips.forEach(item=>item.classList.remove('active'));
  chip.classList.add('active');
  activeFilter=chip.dataset.filter||'all';
  updateCatalog();
}));
window.addEventListener('gbd-catalog-updated',updateCatalog);
updateCatalog();

function gbdRepairStagingLinks(){
  if(!window.location.pathname.startsWith('/staging/')) return;
  document.querySelectorAll('a[href]').forEach(link=>{
    const raw=link.getAttribute('href');
    if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('http://')||raw.startsWith('https://')) return;
    let next=raw;

    if(next==='/') next='/staging/';
    else if(next==='/en/') next='/staging/en/';
    else if(next==='/games/') next=lang==='en'?'/staging/en/games/':'/staging/games/';
    else if(next.startsWith('/en/legal/')) next='/staging'+next;
    else if(next.startsWith('/legal/')) next='/staging'+next;
    else if(next.startsWith('/en/')) next='/staging'+next;

    if(/^\/staging\/(?:en\/)?legal\/(?:imprint|privacy|terms|developer-terms)(?:\.html)?$/.test(next)){
      next=next.replace(/\.html$/,'');
      if(!next.endsWith('/')) next+='/';
    }

    if(next!==raw) link.setAttribute('href',next);
  });
}
gbdRepairStagingLinks();
