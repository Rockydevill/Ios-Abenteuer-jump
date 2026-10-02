(()=>{
  const BASE_URL='https://voldtqsdqcdexkexwerp.supabase.co';
  const PUBLIC_KEY='sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
  const CHECKOUT_URL=BASE_URL+'/functions/v1/gbd-paypal-checkout';
  const button=document.getElementById('livePurchase');
  const message=document.getElementById('checkoutMessage');
  const supply=document.getElementById('immediateSupplyRequested');
  const consequence=document.getElementById('withdrawalConsequenceAcknowledged');
  if(!button) return;

  const locale=button.dataset.locale==='en'?'en':'de';
  const tr=(de,en)=>locale==='en'?en:de;
  const show=(type,text)=>{
    if(!message)return;
    message.hidden=false;
    message.className='form-message '+type;
    message.textContent=text;
  };
  const client=window.supabase.createClient(BASE_URL,PUBLIC_KEY);
  const requestStorageKey='gbd-checkout-request:'+String(button.dataset.slug||'game');
  function requestId(){
    let id=sessionStorage.getItem(requestStorageKey)||'';
    if(!/^[0-9a-fA-F-]{36}$/.test(id)){
      id=crypto.randomUUID();
      sessionStorage.setItem(requestStorageKey,id);
    }
    return id;
  }

  async function api(body){
    const {data:{session}}=await client.auth.getSession();
    if(!session) throw new Error('login_required');
    const r=await fetch(CHECKOUT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,Authorization:'Bearer '+session.access_token},
      body:JSON.stringify(body)
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'checkout_failed');
    return d;
  }

  async function captureFromReturn(){
    const url=new URL(location.href);
    if(url.searchParams.get('paypal')==='cancel'){
      sessionStorage.removeItem(requestStorageKey);
      url.searchParams.delete('paypal');
      history.replaceState({},'',url.pathname+url.search);
      show('error',tr('Der PayPal-Kauf wurde abgebrochen. Es wurde nichts freigeschaltet.','The PayPal purchase was cancelled. Nothing was unlocked.'));
      return;
    }
    if(url.searchParams.get('paypal')!=='return') return;
    const orderId=url.searchParams.get('token');
    if(!orderId){show('error',tr('PayPal-Rückgabe ohne Bestellkennung.','PayPal returned without an order identifier.'));return;}
    button.disabled=true;
    try{
      const d=await api({action:'capture_order',orderId});
      sessionStorage.removeItem(requestStorageKey);
      show('success',tr('Zahlung bestätigt. Dein digitales Nutzungsrecht wurde serverseitig freigeschaltet.','Payment confirmed. Your digital entitlement was granted server-side.'));
      url.searchParams.delete('paypal');url.searchParams.delete('token');url.searchParams.delete('PayerID');
      history.replaceState({},'',url.pathname+url.search);
    }catch(error){
      const map={
        login_required:tr('Bitte melde dich mit deinem EU-Nutzerkonto an und öffne danach die PayPal-Rückgabe erneut.','Please sign in with your EU user account and retry the PayPal return.'),
        payment_currency_mismatch:tr('Die Zahlungswährung stimmt nicht mit dem erwarteten Euro-Betrag überein.','The payment currency does not match the expected EUR amount.'),
        capture_amount_mismatch:tr('Der erfasste Betrag stimmt nicht mit dem erwarteten Endpreis überein.','The captured amount does not match the expected final price.'),
        paypal_capture_not_completed:tr('PayPal meldet noch keinen abgeschlossenen Capture.','PayPal has not reported a completed capture yet.')
      };
      show('error',map[error.message]||tr('Die Zahlung konnte noch nicht bestätigt werden.','The payment could not yet be confirmed.'));
    }finally{button.disabled=false;}
  }

  button.addEventListener('click',async()=>{
    if(supply?.checked!==true||consequence?.checked!==true){
      show('error',tr('Vor dem Kauf müssen beide getrennten Erklärungen zur sofortigen Bereitstellung bestätigt werden.','Both separate confirmations for immediate supply must be checked before purchase.'));
      return;
    }
    button.disabled=true;
    try{
      const d=await api({
        action:'create_order',
        requestId:requestId(),
        gameSlug:button.dataset.slug,
        locale,
        immediateSupplyRequested:true,
        withdrawalConsequenceAcknowledged:true
      });
      if(!d.approveUrl) throw new Error('paypal_approval_url_missing');
      location.href=d.approveUrl;
    }catch(error){
      const map={
        login_required:tr('Bitte melde dich zuerst mit einem EU-Nutzerkonto an.','Please sign in with an EU user account first.'),
        country_not_supported:tr('Für deinen Staat ist diese Funktion nicht verfügbar.','This feature is not available in your country.'),
        country_verification_required:tr('Dein Land konnte für diese Funktion nicht eindeutig bestätigt werden.','Your country could not be confirmed for this function.'),
        digital_supply_consent_required:tr('Die erforderlichen Erklärungen zur sofortigen Bereitstellung fehlen.','The required immediate-supply confirmations are missing.'),
        paid_checkout_closed:tr('Der Echtgeld-Checkout ist derzeit noch nicht freigeschaltet.','Paid checkout is not enabled yet.'),
        merchant_role_review_required:tr('Der Echtgeldbetrieb ist noch nicht rechtlich freigegeben.','Live paid operation has not yet passed its legal review.'),
        tax_oss_review_required:tr('Die Steuer-/OSS-Prüfung ist noch offen.','The tax/OSS review is still pending.'),
        withdrawal_text_review_required:tr('Die finale Widerrufsprüfung ist noch offen.','The final withdrawal review is still pending.'),
        paypal_split_flow_review_required:tr('Der PayPal-Aufteilungsfluss ist noch nicht final freigegeben.','The PayPal split flow is not finally approved yet.'),
        seller_role_review_required:tr('Die endgültige Verkäufer-/Plattformrolle ist noch nicht freigegeben.','The final seller/platform role has not yet been approved.'),
        developer_terms_review_required:tr('Die finalen Entwicklerbedingungen sind noch nicht freigegeben.','The final developer terms have not yet been approved.'),
        privacy_identity_review_required:tr('Die finale Datenschutzprüfung zur Identitätsverarbeitung ist noch offen.','The final privacy review for identity processing is still pending.'),
        retention_policy_review_required:tr('Die finale Aufbewahrungsprüfung ist noch offen.','The final retention review is still pending.'),
        commercial_minors_review_required:tr('Der kommerzielle Minderjährigenprozess ist noch nicht freigegeben.','The commercial minors process has not yet been approved.'),
        refund_dispute_review_required:tr('Die finale Refund-/Dispute-Prüfung ist noch offen.','The final refund/dispute review is still pending.'),
        consumer_checkout_review_required:tr('Die finale Verbraucher-Checkout-Prüfung ist noch offen.','The final consumer checkout review is still pending.'),
        identity_legal_basis_review_required:tr('Die Rechtsgrundlage für die kommerzielle Identitätsprüfung ist noch nicht final freigegeben.','The legal basis for commercial identity verification is not finally approved yet.'),
        identity_country_rules_review_required:tr('Die länderspezifischen Regeln für Identitätsdokumente sind noch nicht final freigegeben.','Country-specific identity document rules are not finally approved yet.'),
        p2b_terms_review_required:tr('Die finale P2B-Prüfung der Entwicklerbedingungen ist noch offen.','The final P2B review of developer terms is still pending.'),
        dsa_trader_traceability_review_required:tr('Die finale DSA-Prüfung zur Händlernachverfolgbarkeit ist noch offen.','The final DSA trader-traceability review is still pending.'),
        geo_blocking_review_required:tr('Die finale Geo-Blocking-Prüfung ist noch offen.','The final geo-blocking review is still pending.'),
        legal_texts_final_review_required:tr('Die finalen Rechtstexte sind noch nicht freigegeben.','The final legal texts have not yet been approved.'),
        checkout_request_id_required:tr('Der sichere Kaufvorgang konnte nicht initialisiert werden.','The secure checkout request could not be initialized.'),
        checkout_idempotency_conflict:tr('Dieser Kaufvorgang passt nicht mehr zum ausgewählten Produkt. Bitte lade die Seite neu.','This checkout request no longer matches the selected product. Please reload the page.')
      };
      show('error',map[error.message]||tr('Der Kauf ist derzeit nicht verfügbar.','Purchase is currently unavailable.'));
      button.disabled=false;
    }
  });

  captureFromReturn();
})();