const PROJECT_URL='https://voldtqsdqcdexkexwerp.supabase.co';
const POLICY_URL=PROJECT_URL+'/functions/v1/gbd-ranking-policy';
const lang=document.body.dataset.rankingLang==='en'?'en':'de';
const statusEl=document.getElementById('rankingStatus');
const policyEl=document.getElementById('rankingPolicy');
const listEl=document.getElementById('rankingParameters');
const paidEl=document.getElementById('paidRanking');
const ownEl=document.getElementById('ownOffers');
const t=(de,en)=>lang==='en'?en:de;
async function load(){
  const r=await fetch(POLICY_URL,{cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.closed===true||d.available!==true||!d.policy){
    statusEl.hidden=false;
    statusEl.textContent=t('Die öffentliche Ranking-Information ist noch nicht freigeschaltet.','Public ranking information has not been enabled yet.');
    policyEl.hidden=true;
    return;
  }
  listEl.textContent='';
  for(const p of Array.isArray(d.policy.mainParameters)?d.policy.mainParameters:[]){
    const li=document.createElement('li');
    li.textContent=lang==='en'?(p.label_en||p.key):(p.label_de||p.key);
    listEl.appendChild(li);
  }
  paidEl.textContent=d.policy.paidInfluenceAllowed===true?t('aktiv','enabled'):t('deaktiviert','disabled');
  const ownMap={
    same_rules:t('werden nach denselben Regeln behandelt','treated under the same rules'),
    separate_disclosed_rules:t('werden nach gesondert offengelegten Regeln behandelt','treated under separately disclosed rules'),
    not_applicable:t('nicht anwendbar','not applicable')
  };
  ownEl.textContent=ownMap[d.policy.ownOffersTreatment]||d.policy.ownOffersTreatment||t('nicht angegeben','not specified');
  statusEl.hidden=true;
  policyEl.hidden=false;
}
load().catch(()=>{statusEl.hidden=false;policyEl.hidden=true;});