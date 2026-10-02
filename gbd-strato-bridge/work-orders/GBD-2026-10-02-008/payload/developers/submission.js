const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const PREPARE_URL = PROJECT_URL + '/functions/v1/gbd-prepare-submission';
const FINALIZE_URL = PROJECT_URL + '/functions/v1/gbd-finalize-submission';
const DEVELOPER_URL = PROJECT_URL + '/functions/v1/gbd-developer';
const TUS_ENDPOINT =
  'https://voldtqsdqcdexkexwerp.storage.supabase.co/storage/v1/upload/resumable';

const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
const portalMain = document.getElementById('portalMain');
const portalLoading = document.getElementById('portalLoading');
const openSubmissionPanel = document.getElementById('openSubmissionPanel');
const submissionPanel = document.getElementById('submissionPanel');
const logoutButton = document.getElementById('developerLogout');
const identity = document.getElementById('developerIdentity');
const submissionsWrap = document.getElementById('developerSubmissions');
const submissionEmail = document.getElementById('submissionEmail');
const submissionFeeLabel = document.getElementById('submissionFeeLabel');
const commissionLabel = document.getElementById('commissionLabel');
const sellerStatusLabel = document.getElementById('sellerStatusLabel');
const paymentSetupNotice = document.getElementById('paymentSetupNotice');
const requestAccountDeletion = document.getElementById('requestAccountDeletion');
const accountControlMessage = document.getElementById('accountControlMessage');
const paypalConnectButton = document.getElementById('paypalConnectButton');
const paypalRefreshButton = document.getElementById('paypalRefreshButton');
const paypalConnectMessage = document.getElementById('paypalConnectMessage');
const developerTermsVersionLabel = document.getElementById('developerTermsVersionLabel');
const PAYPAL_MARKETPLACE_URL = PROJECT_URL + '/functions/v1/gbd-paypal-marketplace';
const COMMERCIAL_VERIFICATION_URL = PROJECT_URL + '/functions/v1/gbd-commercial-verification';

const form = document.getElementById('submissionForm');
const declaredCountrySelect = document.getElementById('declaredCountryCode');
const countryConfirmed = document.getElementById('countryConfirmed');
const correctionPublicId = document.getElementById('correctionPublicId');
const correctionModeNotice = document.getElementById('correctionModeNotice');
const apkInput = document.getElementById('apkFile');
const titleImageInput = document.getElementById('titleImageFile');
const appLogoInput = document.getElementById('appLogoFile');
const screenshotsInput = document.getElementById('screenshotFiles');
const pricingSelect = document.getElementById('pricingSelect');
const paidPriceField = document.getElementById('paidPriceField');
const priceEuroInput = document.getElementById('priceEuro');
const dataProcessingSelect = document.getElementById('dataProcessingSelect');
const privacyPolicyField = document.getElementById('privacyPolicyField');
const privacyPolicyUrl = document.getElementById('privacyPolicyUrl');
const monetizationInfo = document.getElementById('monetizationInfo');
const monetizationFeatureField = document.getElementById('monetizationFeatureField');
const monetizationOtherField = document.getElementById('monetizationOtherField');
const monetizationOtherDescription = document.getElementById('monetizationOtherDescription');
const paymentTermsRow = document.getElementById('paymentTermsRow');
const paymentTermsAccepted = document.getElementById('paymentTermsAccepted');
const apkSelection = document.getElementById('apkSelection');
const titleImageSelection = document.getElementById('titleImageSelection');
const appLogoSelection = document.getElementById('appLogoSelection');
const screenshotSelection = document.getElementById('screenshotSelection');
const formMessage = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');
const progressWrap = document.getElementById('uploadProgress');
const progressLabel = document.getElementById('uploadProgressLabel');
const progressValue = document.getElementById('uploadProgressValue');
const progressBar = document.getElementById('uploadProgressBar');
const commercialVerificationSection = document.getElementById('commercialVerificationSection');
const commercialVerificationBadge = document.getElementById('commercialVerificationBadge');
const commercialVerificationNotice = document.getElementById('commercialVerificationNotice');
const commercialVerificationForm = document.getElementById('commercialVerificationForm');
const commercialVerificationMessage = document.getElementById('commercialVerificationMessage');
const sellerType = document.getElementById('sellerType');
const commercialLegalName = document.getElementById('commercialLegalName');
const commercialAddress1 = document.getElementById('commercialAddress1');
const commercialAddress2 = document.getElementById('commercialAddress2');
const commercialPostalCode = document.getElementById('commercialPostalCode');
const commercialCity = document.getElementById('commercialCity');
const commercialPhone = document.getElementById('commercialPhone');
const commercialBusinessCountry = document.getElementById('commercialBusinessCountry');
const commercialBusinessName = document.getElementById('commercialBusinessName');
const commercialRegisterName = document.getElementById('commercialRegisterName');
const commercialRegisterNumber = document.getElementById('commercialRegisterNumber');
const commercialVatId = document.getElementById('commercialVatId');
const commercialAge18 = document.getElementById('commercialAge18');
const commercialVerificationBegin = document.getElementById('commercialVerificationBegin');
const identityDocumentPanel = document.getElementById('identityDocumentPanel');
const identityDocumentType = document.getElementById('identityDocumentType');
const identityDocumentCountry = document.getElementById('identityDocumentCountry');
const identityDocumentFile = document.getElementById('identityDocumentFile');
const identityDocumentUpload = document.getElementById('identityDocumentUpload');
const identityCopyMarkRow = document.getElementById('identityCopyMarkRow');
const identityCopyMarkedConfirm = document.getElementById('identityCopyMarkedConfirm');

const statusLabels = {
  submitted: 'Eingereicht',
  review: 'In Prüfung',
  correction_required: 'Korrektur erforderlich',
  approved: 'Öffentlich',
  rejected: 'Nicht freigegeben',
};

function developerStatusLabel(item) {
  return statusLabels[item?.status] || item?.status || 'Unbekannt';
}

let currentEmail = '';
let sellerPaymentReady = false;

const ISO_COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
function populateCountryOptions() {
  if (!declaredCountrySelect || declaredCountrySelect.options.length > 1) return;
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['de'], { type: 'region' })
    : null;
  for (const code of ISO_COUNTRY_CODES) {
    const option = document.createElement('option');
    option.value = code;
    let label = code;
    try { label = displayNames?.of(code) || code; } catch {}
    option.textContent = label + ' (' + code + ')';
    declaredCountrySelect.appendChild(option);
  }
}
const EU_COUNTRY_CODES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
function populateVerificationCountryOptions() {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['de'], { type: 'region' })
    : null;
  const fill = (select, codes) => {
    if (!select || select.options.length > 1) return;
    for (const code of codes) {
      const option = document.createElement('option');
      option.value = code;
      let label = code;
      try { label = displayNames?.of(code) || code; } catch {}
      option.textContent = label + ' (' + code + ')';
      select.appendChild(option);
    }
  };
  fill(commercialBusinessCountry, ISO_COUNTRY_CODES.filter(code => EU_COUNTRY_CODES.has(code)));
  fill(identityDocumentCountry, ISO_COUNTRY_CODES);
}
function syncIdentityCopyMarkRequirement() {
  const required = identityDocumentCountry?.value === 'DE' && identityDocumentType?.value === 'national_identity_card';
  if (identityCopyMarkRow) identityCopyMarkRow.hidden = !required;
  if (identityCopyMarkedConfirm) {
    identityCopyMarkedConfirm.required = required;
    if (!required) identityCopyMarkedConfirm.checked = false;
  }
}

function showCommercialVerificationMessage(type, text) {
  if (!commercialVerificationMessage) return;
  commercialVerificationMessage.hidden = false;
  commercialVerificationMessage.className = 'form-message ' + type;
  commercialVerificationMessage.textContent = text;
}

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]
  );
}

function fmtDate(value) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function session() {
  const { data } = await client.auth.getSession();
  return data.session;
}

async function requireConfirmedSession() {
  const activeSession = await session();
  if (!activeSession) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' });
    return null;
  }
  return activeSession;
}

function showAccountMessage(type, text) {
  if (!accountControlMessage) return;
  accountControlMessage.hidden = false;
  accountControlMessage.className = 'form-message ' + type;
  accountControlMessage.textContent = text;
}

function showPayPalMessage(type, text) {
  if (!paypalConnectMessage) return;
  paypalConnectMessage.hidden = false;
  paypalConnectMessage.className = 'form-message ' + type;
  paypalConnectMessage.textContent = text;
}

async function authenticatedApi(url, body) {
  const activeSession = await requireConfirmedSession();
  if (!activeSession) {
    location.replace('/developers/login/');
    throw new Error('login_required');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + activeSession.access_token,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    await client.auth.signOut({ scope: 'local' });
    location.replace('/developers/login/');
    throw new Error('login_required');
  }

  if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
  return data;
}

function renderDeveloperSubmissions(items) {
  if (!items.length) {
    submissionsWrap.innerHTML =
      '<div class="developer-status-empty"><strong>Noch keine Einreichungen.</strong><span>Nach deinem ersten Upload erscheint hier der Prüfstatus.</span></div>';
    return;
  }

  submissionsWrap.innerHTML = items
    .map(item => {
      const isPublic = item.status === 'approved';
      const reviewNotice = item.review_note
        ? '<div class="notice" style="margin-top:10px"><strong>Hinweis zur Prüfung</strong><br>' + esc(item.review_note) + '</div>'
        : '';
      return `
        <article class="developer-status-card">
          <div>
            <span class="status-pill ${esc(item.status)}">${esc(
              developerStatusLabel(item)
            )}</span>
            <h3>${esc(item.game_name)}</h3>
            <p>${esc(item.public_id)}</p>
          </div>
          <div class="developer-status-meta">
            <span><small>Prüfstatus</small><b>${esc(developerStatusLabel(item))}</b></span>
            <span><small>Veröffentlichung</small><b>${isPublic ? 'Öffentlich' : 'Nicht öffentlich'}</b></span>
            <span><small>Eingereicht</small><b>${esc(fmtDate(item.submitted_at))}</b></span>
            <span><small>Genre</small><b>${esc(item.genre)}</b></span>
          </div>
          ${reviewNotice}
          ${item.status === 'correction_required' ? '<div class="developer-dashboard-actions" style="margin-top:12px"><button class="button primary" type="button" data-correct-submission="' + esc(item.public_id) + '">Korrektur bearbeiten</button></div>' : ''}
        </article>`;
    })
    .join('');

  submissionsWrap.querySelectorAll('[data-correct-submission]').forEach(button => {
    button.addEventListener('click', () => {
      const item = items.find(entry => entry.public_id === button.dataset.correctSubmission);
      if (item) beginCorrection(item);
    });
  });
}

function beginCorrection(item) {
  if (!form || item?.status !== 'correction_required') return;

  form.reset();

  setTimeout(() => {
    const setField = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field && 'value' in field) field.value = value ?? '';
    };

    if (correctionPublicId) correctionPublicId.value = item.public_id || '';
    if (correctionModeNotice) correctionModeNotice.hidden = false;

    setField('gameName', item.game_name);
    setField('developerName', item.developer_name);
    setField('declaredCountryCode', item.declared_country_code);
    setField('version', item.version);
    setField('website', item.website);
    setField('minAndroid', item.min_android);
    setField('genre', item.genre);
    setField('pricing', item.pricing);
    setField('shortDescription', item.short_description);
    setField('description', item.description);
    setField('gameplayDescription', item.gameplay_description);
    setField('features', item.features);
    setField('dataProcessing', item.data_processing_declared ? 'yes' : 'no');
    setField('privacyPolicyUrl', item.privacy_policy_url);

    if (priceEuroInput) {
      priceEuroInput.value =
        item.price_cents && item.monetization_code === 'paid'
          ? (Number(item.price_cents) / 100).toFixed(2)
          : '';
    }

    syncMonetizationFields();

    const selected = new Set(
      Array.isArray(item.monetization_features) ? item.monetization_features : []
    );
    form.querySelectorAll('input[name="monetizationFeature"]').forEach(input => {
      input.checked = selected.has(input.value);
    });

    if (monetizationOtherDescription) {
      monetizationOtherDescription.value = item.monetization_other_description || '';
    }

    if (submissionEmail) submissionEmail.value = currentEmail;
    syncMonetizationOtherField();
    syncPrivacyFields();

    if (submitButton) submitButton.textContent = 'Korrigierte Einreichung zur Prüfung senden';
    openSubmissionPanel?.click();
  }, 0);
}

async function loadDeveloperData() {
  const data = await authenticatedApi(DEVELOPER_URL, { action: 'list' });
  currentEmail = data.profile?.email || '';
  identity.textContent = currentEmail;
  submissionEmail.value = currentEmail;
  if (declaredCountrySelect && data.profile?.declaredCountryCode) {
    declaredCountrySelect.value = String(data.profile.declaredCountryCode).toUpperCase();
  }

  const fee = Number(data.marketplace?.submissionFeeCents || 0);
  const commissionBps = Number(data.marketplace?.platformCommissionBps || 1000);
  if (submissionFeeLabel) submissionFeeLabel.textContent = (fee / 100).toLocaleString('de-DE', { style: 'currency', currency: data.marketplace?.currency || 'EUR' });
  if (commissionLabel) commissionLabel.textContent = (commissionBps / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';
  if (developerTermsVersionLabel) {
    const version = String(data.legal?.developerTermsVersion || '').trim();
    developerTermsVersionLabel.textContent = version ? version.replace(/^\d{4}-\d{2}-\d{2}-v/i, 'V') : 'aktuell';
  }

  const sellerLabels = {
    not_connected: 'Noch nicht verbunden',
    pending: 'Verbindung wird geprüft',
    active: 'Aktiv',
    restricted: 'Eingeschränkt',
    disabled: 'Deaktiviert'
  };
  if (sellerStatusLabel) sellerStatusLabel.textContent = sellerLabels[data.profile?.sellerStatus] || data.profile?.sellerStatus || 'Noch nicht verbunden';

  if (paymentSetupNotice) {
    const paidReady = Boolean(data.marketplace?.paidCheckoutEnabled);
    const iapReady = Boolean(data.marketplace?.iapRevenueShareEnabled);
    paymentSetupNotice.textContent = paidReady && iapReady
      ? 'PayPal-Umsatzaufteilung ist aktiv. Kostenpflichtige Games sowie In-App-Käufe, Abos und Pässe können nach Prüfung veröffentlicht werden.'
      : 'Kostenlose Games können normal eingereicht werden. Kostenpflichtige Games sowie Games mit In-App-Käufen, Abos oder Pässen werden erst veröffentlicht, wenn die sichere Umsatzaufteilung eingerichtet ist.';
  }

  try {
    const paypal = await authenticatedApi(PAYPAL_MARKETPLACE_URL, { action: 'status' });
    const platformReady = ['sandbox_ready', 'approved'].includes(paypal.platform?.status);
    const sellerActive = paypal.seller?.status === 'active' && paypal.seller?.paymentsReceivable === true;
    sellerPaymentReady = sellerActive;
    if (paypalConnectButton) {
      paypalConnectButton.disabled = !platformReady || sellerActive;
      paypalConnectButton.textContent = sellerActive
        ? 'PayPal verbunden'
        : platformReady
          ? 'PayPal-Verkäuferkonto verbinden'
          : 'PayPal-Plattformfreigabe ausstehend';
    }

    if (paypalRefreshButton) {
      paypalRefreshButton.hidden = !paypal.seller?.merchantId || sellerActive;
    }

    if (sellerActive && sellerStatusLabel) sellerStatusLabel.textContent = 'Aktiv';
  } catch (error) {
    sellerPaymentReady = false;
    if (paypalConnectButton) paypalConnectButton.disabled = true;
  }

  if (requestAccountDeletion) {
    const pending = Boolean(data.deletionRequest);
    requestAccountDeletion.disabled = pending;
    requestAccountDeletion.textContent = pending ? 'Löschung angefordert' : 'Kontolöschung anfordern';
    if (pending) {
      showAccountMessage('success', 'Deine Kontolöschung wurde angefordert und wird geprüft.');
    }
  }

  try {
    const verification = await authenticatedApi(COMMERCIAL_VERIFICATION_URL, { action: 'status' });
    const status = String(verification.commercialVerificationStatus || data.profile?.commercialVerificationStatus || 'not_required');
    const labels = {
      not_required: 'NICHT ERFORDERLICH',
      required: 'ERFORDERLICH',
      pending: 'WIRD GEPRÜFT',
      needs_more_information: 'ANGABEN FEHLEN',
      verified: 'VERIFIZIERT',
      rejected: 'ABGELEHNT',
      expired: 'ABGELAUFEN',
      suspended: 'GESPERRT'
    };
    if (commercialVerificationBadge) commercialVerificationBadge.textContent = labels[status] || status.toUpperCase();

    const enabled = Boolean(data.marketplace?.commercialVerificationEnabled);
    const uploadEnabled = Boolean(data.marketplace?.identityDocumentUploadEnabled);
    if (commercialVerificationForm) {
      commercialVerificationForm.hidden = !enabled || status === 'verified';
    }
    if (identityDocumentPanel) {
      identityDocumentPanel.hidden = !enabled || !uploadEnabled || !['required','pending','needs_more_information'].includes(status);
    }
    if (commercialVerificationNotice) {
      if (status === 'verified') {
        commercialVerificationNotice.textContent = 'Die kommerzielle Identitäts- und Händlerprüfung ist abgeschlossen. Eine Auszahlung oder Echtgeldfunktion bleibt zusätzlich von den jeweiligen PayPal-, Steuer- und Checkout-Freigaben abhängig.';
      } else if (!enabled && status !== 'not_required') {
        commercialVerificationNotice.textContent = 'Für dieses Konto ist eine kommerzielle Verifizierung erforderlich. Die Verifizierungsfunktion ist derzeit noch zentral gesperrt; monetarisierte Angebote können bis zur späteren Freigabe nicht veröffentlicht werden.';
      } else if (!enabled) {
        commercialVerificationNotice.textContent = 'Für vollständig kostenlose Spiele ohne Monetarisierung ist keine Ausweiskopie erforderlich. Die kommerzielle Verifizierung bleibt bis zur späteren Freigabe deaktiviert.';
      } else {
        commercialVerificationNotice.textContent = 'Für monetarisierte Angebote ist vor der Veröffentlichung eine zusätzliche Identitäts- und Händlerprüfung erforderlich. Rohdokumente bleiben privat und werden nach abgeschlossener Prüfung grundsätzlich gelöscht, soweit kein dokumentierter Aufbewahrungsgrund besteht.';
      }
    }
  } catch (error) {
    if (commercialVerificationForm) commercialVerificationForm.hidden = true;
    if (identityDocumentPanel) identityDocumentPanel.hidden = true;
  }

  renderDeveloperSubmissions(data.submissions || []);
}

async function bootPortal() {
  const activeSession = await requireConfirmedSession();
  if (!activeSession) {
    location.replace('/developers/login/');
    return;
  }

  await completePayPalReturnIfPresent();
  await loadDeveloperData();

  portalMain.hidden = false;
  if (portalLoading) portalLoading.hidden = true;

  // Android/WebView kann nach dem Umschalten von hidden sonst einen schwarzen
  // Frame behalten. Layout einmal synchron lesen und im nächsten Frame freigeben.
  void portalMain.offsetHeight;
  requestAnimationFrame(() => document.body.classList.add('portal-ready'));
}

openSubmissionPanel?.addEventListener('click', () => {
  if (!submissionPanel || portalMain.hidden) return;

  const header = document.querySelector('.site-header');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const top = submissionPanel.getBoundingClientRect().top + window.scrollY - headerHeight - 12;

  // Kein Hash/Smooth-Scroll: vermeidet den Android-Repaintfehler im langen Formular.
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  void submissionPanel.offsetHeight;
  requestAnimationFrame(() => {
    submissionPanel.getBoundingClientRect();
  });
});

requestAccountDeletion?.addEventListener('click', async () => {
  const confirmed = confirm(
    'Kontolöschung wirklich anfordern? Veröffentlichte Spiele und gesetzlich notwendige Abrechnungsdaten werden dabei nicht automatisch gelöscht.'
  );
  if (!confirmed) return;

  requestAccountDeletion.disabled = true;
  try {
    await authenticatedApi(DEVELOPER_URL, { action: 'request_delete' });
    requestAccountDeletion.textContent = 'Löschung angefordert';
    showAccountMessage('success', 'Die Kontolöschung wurde angefordert.');
  } catch (error) {
    requestAccountDeletion.disabled = false;
    showAccountMessage('error', 'Löschantrag fehlgeschlagen: ' + error.message);
  }
});

commercialVerificationForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (commercialVerificationMessage) commercialVerificationMessage.hidden = true;
  if (!commercialVerificationForm.checkValidity()) {
    commercialVerificationForm.reportValidity();
    return;
  }
  commercialVerificationBegin.disabled = true;
  try {
    const result = await authenticatedApi(COMMERCIAL_VERIFICATION_URL, {
      action: 'begin',
      declaredCountryCode: declaredCountrySelect?.value || '',
      sellerType: sellerType?.value || '',
      legalName: commercialLegalName?.value || '',
      addressLine1: commercialAddress1?.value || '',
      addressLine2: commercialAddress2?.value || '',
      postalCode: commercialPostalCode?.value || '',
      city: commercialCity?.value || '',
      phone: commercialPhone?.value || '',
      businessCountryCode: commercialBusinessCountry?.value || '',
      businessName: commercialBusinessName?.value || '',
      registerName: commercialRegisterName?.value || '',
      registerNumber: commercialRegisterNumber?.value || '',
      vatId: commercialVatId?.value || '',
      age18Confirmed: commercialAge18?.checked === true
    });
    showCommercialVerificationMessage('success', 'Verifizierungsdaten wurden sicher gespeichert. Status: ' + (result.status || 'pending') + '.');
    await loadDeveloperData();
  } catch (error) {
    const messages = {
      commercial_verification_closed: 'Die kommerzielle Verifizierung ist derzeit zentral gesperrt.',
      country_not_supported: 'Für deinen Staat ist diese Funktion nicht verfügbar.',
      country_verification_required: 'Dein Land konnte für diese Funktion nicht eindeutig bestätigt werden.',
      age_confirmation_required: 'Bitte bestätige, dass du mindestens 18 Jahre alt bist.',
      seller_type_required: 'Bitte gib an, in welcher Anbieterrolle du handelst.',
      commercial_profile_incomplete: 'Bitte fülle die erforderlichen Händler- und Kontaktdaten vollständig aus.',
      business_country_required: 'Bei Unternehmen muss der Unternehmenssitz angegeben werden.'
    };
    showCommercialVerificationMessage('error', messages[error.message] || ('Verifizierung konnte nicht gestartet werden: ' + error.message));
  } finally {
    commercialVerificationBegin.disabled = false;
  }
});

identityDocumentUpload?.addEventListener('click', async () => {
  const file = identityDocumentFile?.files?.[0];
  if (!file || !identityDocumentType?.value || !identityDocumentCountry?.value) {
    showCommercialVerificationMessage('error', 'Bitte Dokumenttyp, Ausstellungsland und Datei auswählen.');
    return;
  }
  identityDocumentUpload.disabled = true;
  try {
    const status = await authenticatedApi(COMMERCIAL_VERIFICATION_URL, { action: 'status' });
    const verificationId = status.verification?.id;
    if (!verificationId) throw new Error('verification_required');
    const prepared = await authenticatedApi(COMMERCIAL_VERIFICATION_URL, {
      action: 'prepare_document_upload',
      verificationId,
      documentType: identityDocumentType.value,
      documentCountry: identityDocumentCountry.value,
      copyMarkedConfirmed: identityCopyMarkedConfirm?.checked === true,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size
    });
    const { error: uploadError } = await client.storage
      .from('gbd-identity-documents')
      .uploadToSignedUrl(prepared.storagePath, prepared.uploadToken, file, {
        contentType: file.type,
        upsert: false
      });
    if (uploadError) throw uploadError;
    await authenticatedApi(COMMERCIAL_VERIFICATION_URL, {
      action: 'finalize_document',
      verificationId,
      documentId: prepared.documentId,
      storagePath: prepared.storagePath,
      documentType: identityDocumentType.value,
      documentCountry: identityDocumentCountry.value,
      mimeType: file.type
    });
    identityDocumentFile.value = '';
    showCommercialVerificationMessage('success', 'Der amtliche Identitätsnachweis wurde privat gespeichert und zur manuellen Prüfung vorgemerkt.');
    await loadDeveloperData();
  } catch (error) {
    const messages = {
      identity_document_upload_closed: 'Der sichere Dokumentupload ist derzeit noch zentral gesperrt.',
      verification_required: 'Starte zuerst die kommerzielle Verifizierung.',
      invalid_document_type: 'Erlaubt sind PDF, JPG, PNG und WebP.',
      invalid_document_size: 'Die Datei ist zu groß oder leer.'
    };
    showCommercialVerificationMessage('error', messages[error.message] || ('Dokumentupload fehlgeschlagen: ' + error.message));
  } finally {
    identityDocumentUpload.disabled = false;
  }
});

paypalConnectButton?.addEventListener('click', async () => {
  paypalConnectButton.disabled = true;
  if (paypalConnectMessage) paypalConnectMessage.hidden = true;

  try {
    const data = await authenticatedApi(PAYPAL_MARKETPLACE_URL, { action: 'start_onboarding' });
    if (!data.actionUrl) throw new Error('PayPal-Link fehlt');
    location.href = data.actionUrl;
  } catch (error) {
    const messages = {
      paypal_platform_not_approved: 'Games Behind Doors wartet noch auf die PayPal-Plattformfreigabe.',
      paypal_platform_not_configured: 'Die PayPal-Plattformdaten sind noch nicht vollständig eingerichtet.',
      paypal_partner_referral_failed: 'PayPal konnte den Verkäufer-Link noch nicht erstellen.'
    };
    showPayPalMessage('error', messages[error.message] || ('PayPal-Verbindung fehlgeschlagen: ' + error.message));
    paypalConnectButton.disabled = false;
  }
});

paypalRefreshButton?.addEventListener('click', async () => {
  paypalRefreshButton.disabled = true;
  try {
    const data = await authenticatedApi(PAYPAL_MARKETPLACE_URL, { action: 'refresh_status' });
    if (data.sellerStatus === 'active') {
      showPayPalMessage('success', 'PayPal-Verkäuferkonto ist vollständig verbunden und kann Zahlungen empfangen.');
      await loadDeveloperData();
    } else {
      showPayPalMessage('error', 'PayPal ist noch nicht vollständig freigeschaltet. Bitte offene Schritte im PayPal-Konto abschließen.');
    }
  } catch (error) {
    showPayPalMessage('error', 'PayPal-Status konnte nicht geprüft werden: ' + error.message);
  } finally {
    paypalRefreshButton.disabled = false;
  }
});

async function completePayPalReturnIfPresent() {
  const params = new URLSearchParams(location.search);
  if (params.get('paypal') !== 'return') return;

  const merchantIdInPayPal = params.get('merchantIdInPayPal');
  const permissionsGranted = params.get('permissionsGranted');
  const consentStatus = params.get('consentStatus');
  const riskStatus = params.get('riskStatus');

  try {
    const result = await authenticatedApi(PAYPAL_MARKETPLACE_URL, {
      action: 'complete_onboarding',
      merchantIdInPayPal,
      permissionsGranted,
      consentStatus,
      riskStatus
    });

    history.replaceState({}, document.title, location.pathname);

    if (result.sellerStatus === 'active') {
      showPayPalMessage('success', 'PayPal-Verkäuferkonto wurde erfolgreich verbunden.');
    } else {
      showPayPalMessage('error', 'PayPal wurde verbunden, aber die Freigabe ist noch nicht vollständig.');
    }
  } catch (error) {
    history.replaceState({}, document.title, location.pathname);
    showPayPalMessage('error', 'PayPal-Rückkehr konnte nicht bestätigt werden: ' + error.message);
  }
}

logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;

  try {
    await client.auth.signOut({ scope: 'local' });
  } finally {
    location.replace('/developers/login/');
  }
});

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes) || 0;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return value.toFixed(unit === 0 ? 0 : 1) + ' ' + units[unit];
}

function showMessage(type, text) {
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
  formMessage.textContent = text;
}

function setProgress(label, percent) {
  progressWrap.hidden = false;
  progressLabel.textContent = label;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  progressValue.textContent = p + ' %';
  progressBar.style.width = p + '%';
}

function uploadTus(file, descriptor, onProgress) {
  if (descriptor?.provider === 'strato' && descriptor?.method === 'PUT' && descriptor?.url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', descriptor.url, true);
      Object.entries(descriptor.headers || {}).forEach(([name, value]) => {
        if (value != null) request.setRequestHeader(name, String(value));
      });
      request.upload.onprogress = event => {
        onProgress(event.lengthComputable && event.total ? event.loaded / event.total : 0);
      };
      request.onerror = () => reject(new Error('strato_upload_failed'));
      request.onabort = () => reject(new Error('strato_upload_aborted'));
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          onProgress(1);
          resolve();
          return;
        }
        let code = 'strato_upload_failed';
        try {
          code = JSON.parse(request.responseText || '{}').error || code;
        } catch {}
        reject(new Error(code));
      };
      request.send(file);
    });
  }

  return new Promise((resolve, reject) => {
    if (!descriptor?.bucket || !descriptor?.path || !descriptor?.token) {
      reject(new Error('invalid_upload_descriptor'));
      return;
    }
    const upload = new tus.Upload(file, {
      endpoint: TUS_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { 'x-signature': descriptor.token, apikey: PUBLISHABLE_KEY },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: descriptor.bucket,
        objectName: descriptor.path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: reject,
      onProgress: (done, total) => onProgress(total ? done / total : 0),
      onSuccess: () => resolve(),
    });

    upload
      .findPreviousUploads()
      .then(previous => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

function syncMonetizationOtherField() {
  const otherSelected = Boolean(
    form?.querySelector('input[name="monetizationFeature"][value="other_real_money"]:checked')
  );
  if (monetizationOtherField) monetizationOtherField.hidden = !otherSelected;
  if (monetizationOtherDescription) {
    monetizationOtherDescription.required = otherSelected;
    if (!otherSelected) monetizationOtherDescription.value = '';
  }
}

function syncMonetizationFields() {
  const paid = pricingSelect?.value === 'Kostenpflichtig';
  const inAppModel =
    pricingSelect?.value === 'Kostenlos mit In-Game-Käufen / Abos / Pässen';
  const adMonetized = pricingSelect?.value === 'Kostenlos mit Werbung';
  const commercialRequired = paid || inAppModel || adMonetized;
  const paymentMonetized = paid || inAppModel;

  if (paidPriceField) paidPriceField.hidden = !paid;
  if (monetizationInfo) monetizationInfo.hidden = !commercialRequired;
  if (monetizationFeatureField) monetizationFeatureField.hidden = !paymentMonetized;
  if (!paymentMonetized && form) {
    form.querySelectorAll('input[name="monetizationFeature"]').forEach(input => {
      input.checked = false;
    });
  }
  if (priceEuroInput) {
    priceEuroInput.required = paid;
    if (!paid) priceEuroInput.value = '';
  }

  if (paymentTermsRow) paymentTermsRow.hidden = !paymentMonetized;
  if (paymentTermsAccepted) {
    paymentTermsAccepted.required = paymentMonetized;
    if (!paymentMonetized) paymentTermsAccepted.checked = false;
  }

  syncMonetizationOtherField();
}

function syncPrivacyFields() {
  const needsPolicy = dataProcessingSelect?.value === 'yes';
  if (privacyPolicyField) privacyPolicyField.hidden = !needsPolicy;
  if (privacyPolicyUrl) {
    privacyPolicyUrl.required = needsPolicy;
    if (!needsPolicy) privacyPolicyUrl.value = '';
  }
}

pricingSelect?.addEventListener('change', syncMonetizationFields);
form?.querySelectorAll('input[name="monetizationFeature"]').forEach(input => {
  input.addEventListener('change', syncMonetizationOtherField);
});
dataProcessingSelect?.addEventListener('change', syncPrivacyFields);

apkInput?.addEventListener('change', () => {
  const file = apkInput.files?.[0];
  apkSelection.textContent = file
    ? file.name + ' • ' + formatBytes(file.size)
    : 'Noch keine Datei gewählt';
});

titleImageInput?.addEventListener('change', () => {
  const file = titleImageInput.files?.[0];
  titleImageSelection.textContent = file
    ? file.name + ' • ' + formatBytes(file.size)
    : 'Noch kein Titelbild gewählt';
});

appLogoInput?.addEventListener('change', () => {
  const file = appLogoInput.files?.[0];
  appLogoSelection.textContent = file
    ? file.name + ' • ' + formatBytes(file.size)
    : 'Noch kein App-Logo gewählt';
});

screenshotsInput?.addEventListener('change', () => {
  const files = [...(screenshotsInput.files || [])];

  if (files.length > 6) {
    screenshotsInput.value = '';
    showMessage('error', 'Bitte höchstens 6 Screenshots auswählen.');
  }

  screenshotSelection.textContent = files.length
    ? files.length + ' Bild' + (files.length === 1 ? '' : 'er') + ' gewählt'
    : 'Noch keine Bilder gewählt';
});

form?.addEventListener('reset', () => {
  setTimeout(() => {
    apkSelection.textContent = 'Noch keine Datei gewählt';
    titleImageSelection.textContent = 'Noch kein Titelbild gewählt';
    appLogoSelection.textContent = 'Noch kein App-Logo gewählt';
    screenshotSelection.textContent = 'Noch keine Bilder gewählt';
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    submissionEmail.value = currentEmail;
    if (correctionPublicId) correctionPublicId.value = '';
    if (correctionModeNotice) correctionModeNotice.hidden = true;
    if (submitButton) submitButton.textContent = 'Einreichung zur Prüfung senden';
    syncMonetizationFields();
    syncPrivacyFields();
  }, 0);
});

form?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!(await requireConfirmedSession())) {
    location.replace('/developers/login/');
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    showMessage('error', 'Bitte alle Pflichtfelder vollständig ausfüllen.');
    return;
  }

  const monetized =
    pricingSelect?.value === 'Kostenpflichtig' ||
    ['Kostenlos mit In-Game-Käufen', 'Kostenlos mit In-Game-Käufen / Abos / Pässen'].includes(pricingSelect?.value);

  if (monetized && !paymentTermsAccepted?.checked) {
    showMessage(
      'error',
      'Bitte die 10-%-Plattformprovision, die getrennten PayPal-Gebühren und die erforderliche PayPal-Verkäuferanbindung bestätigen.'
    );
    return;
  }

  const inAppModel = pricingSelect?.value === 'Kostenlos mit In-Game-Käufen / Abos / Pässen';
  const selectedMonetizationFeatures = form
    ? [...form.querySelectorAll('input[name="monetizationFeature"]:checked')].map(input => input.value)
    : [];
  if (inAppModel && selectedMonetizationFeatures.length === 0) {
    showMessage('error', 'Bitte mindestens eine Echtgeldfunktion auswählen.');
    return;
  }

  const otherMonetizationDescription = String(monetizationOtherDescription?.value || '').trim();
  if (
    selectedMonetizationFeatures.includes('other_real_money') &&
    (otherMonetizationDescription.length < 3 || otherMonetizationDescription.length > 500)
  ) {
    showMessage('error', 'Bitte die andere Echtgeldfunktion mit 3 bis 500 Zeichen beschreiben.');
    return;
  }

  const apk = apkInput.files?.[0];
  const titleImage = titleImageInput.files?.[0];
  const appLogo = appLogoInput.files?.[0];
  const screenshots = [...(screenshotsInput.files || [])];

  const lowerGameFile = String(apk?.name || '').toLowerCase();
  const supportedGameFile = ['.apk', '.zip', '.html', '.htm'].some(ext =>
    lowerGameFile.endsWith(ext)
  );

  if (!apk || !supportedGameFile) {
    showMessage('error', 'Bitte eine APK-, ZIP-, HTML- oder HTM-Datei auswählen.');
    return;
  }

  if (apk.size > 300 * 1024 * 1024) {
    showMessage('error', 'Die Spiel-Datei darf maximal 300 MB groß sein.');
    return;
  }

  const allowedImages = ['image/png', 'image/jpeg', 'image/webp'];
  if (!titleImage || !allowedImages.includes(titleImage.type)) {
    showMessage('error', 'Bitte ein gültiges Titelbild als PNG, JPG oder WebP auswählen.');
    return;
  }
  if (!appLogo || !allowedImages.includes(appLogo.type)) {
    showMessage('error', 'Bitte ein gültiges App-Logo als PNG, JPG oder WebP auswählen.');
    return;
  }
  if (titleImage.size > 15 * 1024 * 1024 || appLogo.size > 15 * 1024 * 1024) {
    showMessage('error', 'Titelbild und App-Logo dürfen jeweils maximal 15 MB groß sein.');
    return;
  }

  if (screenshots.length > 6) {
    showMessage('error', 'Bitte höchstens 6 Screenshots auswählen.');
    return;
  }

  if (screenshots.some(file => file.size > 15 * 1024 * 1024)) {
    showMessage('error', 'Ein Screenshot ist größer als 15 MB.');
    return;
  }

  submitButton.disabled = true;
  formMessage.hidden = true;
  setProgress('Upload wird vorbereitet …', 1);

  try {
    const fd = new FormData(form);
    const priceEuroRaw = String(fd.get('priceEuro') || '').trim().replace(',', '.');
    const priceCents = String(fd.get('pricing') || '') === 'Kostenpflichtig'
      ? Math.round(Number(priceEuroRaw) * 100)
      : null;

    if (String(fd.get('pricing') || '') === 'Kostenpflichtig' && (!Number.isInteger(priceCents) || priceCents < 50)) {
      showMessage('error', 'Bitte einen gültigen Verkaufspreis ab 0,50 € eingeben.');
      submitButton.disabled = false;
      return;
    }

    const payload = {
      correctionPublicId: String(fd.get('correctionPublicId') || '').trim(),
      gameName: String(fd.get('gameName') || '').trim(),
      developerName: String(fd.get('developerName') || '').trim(),
      declaredCountryCode: String(fd.get('declaredCountryCode') || '').trim().toUpperCase(),
      countryConfirmed: fd.get('countryConfirmed') === 'on',
      version: String(fd.get('version') || '').trim(),
      website: String(fd.get('website') || '').trim(),
      minAndroid: String(fd.get('minAndroid') || ''),
      genre: String(fd.get('genre') || ''),
      pricing: String(fd.get('pricing') || ''),
      priceCents,
      monetizationFeatures: selectedMonetizationFeatures,
      monetizationOtherDescription: otherMonetizationDescription,
      dataProcessing: String(fd.get('dataProcessing') || ''),
      privacyPolicyUrl: String(fd.get('privacyPolicyUrl') || '').trim(),
      shortDescription: String(fd.get('shortDescription') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      gameplayDescription: String(fd.get('gameplayDescription') || '').trim(),
      features: String(fd.get('features') || '').trim(),
      websiteTrap: String(fd.get('websiteTrap') || ''),
      rightsConfirmed: fd.get('rightsConfirmed') === 'on',
      manualReviewAccepted: fd.get('manualReviewAccepted') === 'on',
      developerTermsAccepted: fd.get('developerTermsAccepted') === 'on',
      monetizationDeclared: fd.get('monetizationDeclared') === 'on',
      paymentTermsAccepted: fd.get('paymentTermsAccepted') === 'on',
      apk: {
        name: apk.name,
        size: apk.size,
        type: apk.type || 'application/octet-stream',
      },
      titleImage: {
        name: titleImage.name,
        size: titleImage.size,
        type: titleImage.type,
      },
      appLogo: {
        name: appLogo.name,
        size: appLogo.size,
        type: appLogo.type,
      },
      screenshots: screenshots.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    };

    const prepared = await authenticatedApi(PREPARE_URL, payload);
    const totalBytes =
      apk.size +
      titleImage.size +
      appLogo.size +
      screenshots.reduce((total, file) => total + file.size, 0);
    let completedBytes = 0;

    setProgress('Spiel-Datei wird hochgeladen …', 3);
    await uploadTus(apk, prepared.upload.apk, ratio => {
      setProgress(
        'Spiel-Datei wird hochgeladen …',
        3 + ratio * (apk.size / totalBytes) * 90
      );
    });

    completedBytes += apk.size;

    await uploadTus(titleImage, prepared.upload.titleImage, ratio => {
      const before = completedBytes / totalBytes;
      setProgress(
        'Titelbild wird hochgeladen …',
        3 + (before + ratio * (titleImage.size / totalBytes)) * 90
      );
    });
    completedBytes += titleImage.size;

    await uploadTus(appLogo, prepared.upload.appLogo, ratio => {
      const before = completedBytes / totalBytes;
      setProgress(
        'App-Logo wird hochgeladen …',
        3 + (before + ratio * (appLogo.size / totalBytes)) * 90
      );
    });
    completedBytes += appLogo.size;

    for (let i = 0; i < screenshots.length; i++) {
      const file = screenshots[i];
      const before = completedBytes / totalBytes;

      await uploadTus(file, prepared.upload.screenshots[i], ratio => {
        setProgress(
          'Screenshot ' +
            (i + 1) +
            ' von ' +
            screenshots.length +
            ' wird hochgeladen …',
          3 + (before + ratio * (file.size / totalBytes)) * 90
        );
      });

      completedBytes += file.size;
    }

    setProgress('Einreichung wird finalisiert …', 96);

    const finalized = await authenticatedApi(FINALIZE_URL, {
      sessionId: prepared.sessionId,
      finalizeToken: prepared.finalizeToken,
    });

    setProgress('Einreichung abgeschlossen', 100);

    const mailText = finalized.mail?.sent
      ? ' Die Prüf-Mail wurde versendet.'
      : ' Die Einreichung ist gespeichert; die Prüf-Mail konnte nicht zugestellt werden.';

    const id = finalized.publicId;
    form.reset();
    await loadDeveloperData();

    setTimeout(() => {
      progressWrap.hidden = false;
      progressBar.style.width = '100%';
      progressValue.textContent = '100 %';
      progressLabel.textContent = 'Einreichung abgeschlossen';
      showMessage(
        'success',
        'Einreichung ' +
          id +
          ' wurde vollständig hochgeladen und wartet auf Prüfung.' +
          mailText
      );
      window.scrollTo({
        top: document.querySelector('.developer-status-section').offsetTop - 20,
        behavior: 'smooth',
      });
    }, 0);
  } catch (error) {
    console.error(error);
    const messages = {
      payment_terms_required: 'Bitte die Monetarisierungsbedingungen für die 10-%-GBD-Provision bestätigen.',
      monetization_other_description_required: 'Bitte die andere Echtgeldfunktion vollständig beschreiben.',
      correction_target_invalid: 'Diese Korrektur kann nicht mehr verwendet werden. Bitte den aktuellen Prüfstatus neu laden.',
      developer_registration_closed: 'Neue Entwicklerkonten sind derzeit nicht freigeschaltet.',
      developer_portal_closed: 'Das Entwicklerportal ist derzeit noch nicht freigeschaltet.',
      submissions_closed: 'Spieleinreichungen sind derzeit noch nicht freigeschaltet.',
      country_required: 'Bitte wähle dein Wohnsitz- bzw. Unternehmensland aus.',
      country_confirmation_required: 'Bitte bestätige die Länderangabe.',
      country_not_supported: 'Für deinen Staat ist diese Funktion nicht verfügbar.',
      country_verification_required: 'Dein angegebenes Land stimmt nicht mit dem aktuell ermittelten Zugriffsland überein oder konnte nicht eindeutig geprüft werden. Bitte prüfe deine Verbindung oder wende dich an den Support.'
    };
    showMessage(
      'error',
      messages[error?.message] || ('Upload fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler'))
    );
  } finally {
    submitButton.disabled = false;
  }
});

client.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') location.replace('/developers/login/');
});

populateCountryOptions();
populateVerificationCountryOptions();
syncMonetizationFields();
syncPrivacyFields();

bootPortal().catch(async error => {
  console.error(error);
  if (portalLoading) portalLoading.hidden = true;
  if (['developer_registration_closed', 'developer_portal_closed'].includes(error?.message)) {
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
  }
  location.replace('/developers/login/');
});