const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
const ADMIN_URL = PROJECT_URL + '/functions/v1/gbd-admin';
const ADMIN_RELEASE_URL = PROJECT_URL + '/functions/v1/gbd-admin-release';
const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);

const statusLabels = {
  submitted: 'Eingereicht',
  review: 'In Prüfung',
  correction_required: 'Korrektur erforderlich',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
};

const monetizationLabels = {
  real_money_shop: 'Echtgeld-Shop',
  in_app_purchase: 'In-App-Kauf',
  subscription: 'Abo',
  pass_purchase: 'Pass',
  battle_pass: 'Battle Pass',
  season_pass: 'Season Pass',
  other_pass: 'Sonstiger Pass',
  premium_currency: 'Premium-Währung',
  coin_pack: 'Münzpaket',
  premium_content: 'Premium-Inhalt',
  dlc: 'DLC-artiger Inhalt',
  external_purchase: 'Externe Kaufseite',
  donation: 'Spende',
  tip: 'Trinkgeld',
  other_real_money: 'Andere Echtgeldfunktion',
};
const login = document.getElementById('adminLogin');
const app = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const logoutButton = document.getElementById('logoutButton');
const mfaSection = document.getElementById('adminMfa');
const mfaForm = document.getElementById('mfaForm');
const mfaCode = document.getElementById('mfaCode');
const mfaMessage = document.getElementById('mfaMessage');
const mfaEnrollBlock = document.getElementById('mfaEnrollBlock');
const mfaQr = document.getElementById('mfaQr');
const mfaSecret = document.getElementById('mfaSecret');
const mfaCancel = document.getElementById('mfaCancel');
let activeFactorId = null;
let enrollingNewFactor = false;
const dynamic = document.getElementById('dynamicSubmissions');
const tabs = [...document.querySelectorAll('[data-admin-filter]')];
let items = [];
let activeFilter = 'all';

const esc = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
function safeHttpUrl(v) {
  try {
    const u = new URL(String(v || ''));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}
function fmtDate(v) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(v));
  } catch {
    return v;
  }
}
function fmtBytes(v) {
  v = Number(v) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1048576) return (v / 1024).toFixed(1) + ' KB';
  return (v / 1048576).toFixed(1) + ' MB';
}
function loginMsg(type, text) {
  loginMessage.hidden = false;
  loginMessage.className = 'form-message ' + type;
  loginMessage.textContent = text;
}
function mfaMsg(type, text) {
  mfaMessage.hidden = false;
  mfaMessage.className = 'form-message ' + type;
  mfaMessage.textContent = text;
}

async function session() {
  const { data } = await client.auth.getSession();
  return data.session;
}
async function callAdmin(body) {
  const s = await session();
  if (!s) throw new Error('Nicht angemeldet');
  const r = await fetch(ADMIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + s.access_token,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}
async function callAdminRelease(body) {
  const s = await session();
  if (!s) throw new Error('Nicht angemeldet');
  const r = await fetch(ADMIN_RELEASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + s.access_token,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}
function updateStats() {
  const ids = {
    submitted: 'statSubmitted',
    review: 'statReview',
    correction_required: 'statCorrection',
    approved: 'statApproved',
    rejected: 'statRejected',
  };
  for (const [status, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = items.filter(x => x.status === status).length;
  }
}
function render() {
  updateStats();
  const visible = items.filter(
    x => activeFilter === 'all' || x.status === activeFilter
  );
  if (!visible.length) {
    dynamic.innerHTML =
      '<div class="admin-empty"><strong>Keine Einreichungen in diesem Bereich.</strong><span>Neue Uploads erscheinen hier nach erfolgreicher Finalisierung.</span></div>';
    return;
  }
  dynamic.innerHTML = visible
    .map(
      item => `
    <article class="submission-card" data-id="${esc(item.id)}">
      <div class="submission-card-head"><div><span class="status-pill ${esc(item.status)}">${esc(statusLabels[item.status] || item.status)}</span><h2>${esc(item.game_name)}</h2><p>${esc(item.developer_name)} • ${esc(item.genre)} • ${esc(item.pricing)}</p></div><span class="submission-id">${esc(item.public_id)}</span></div>
      <div class="submission-meta">
<span><small>Version</small><b>${esc(item.version || '–')}</b></span><span><small>Minimum</small><b>${esc(item.min_android)}</b></span><span><small>Spiel-Datei</small><b>${esc(item.apk_original_name)}</b></span><span><small>Größe</small><b>${esc(fmtBytes(item.apk_size_bytes))}</b></span><span><small>Monetarisierung</small><b>${esc(item.pricing)}${item.price_cents ? " • " + esc((item.price_cents/100).toLocaleString("de-DE",{style:"currency",currency:item.currency||"EUR"})) : ""}</b></span>
      </div>
      <div class="review-file-actions">
        ${item.apkSignedUrl ? `<a class="button secondary small-button" target="_blank" rel="noopener" href="${esc(item.apkSignedUrl)}">Spiel-Datei zur Prüfung herunterladen</a>` : ''}
      </div>
      <div class="admin-artwork-review">
        ${item.titleImageSignedUrl ? `<figure><figcaption>Titelbild</figcaption><a target="_blank" rel="noopener" href="${esc(item.titleImageSignedUrl)}"><img src="${esc(item.titleImageSignedUrl)}" alt="Titelbild"></a></figure>` : `<div class="notice">Titelbild fehlt bei dieser älteren Einreichung.</div>`}
        ${item.appLogoSignedUrl ? `<figure><figcaption>App-Logo</figcaption><a target="_blank" rel="noopener" href="${esc(item.appLogoSignedUrl)}"><img src="${esc(item.appLogoSignedUrl)}" alt="App-Logo"></a></figure>` : `<div class="notice">App-Logo fehlt bei dieser älteren Einreichung.</div>`}
      </div>
      <div class="admin-shot-review-head"><strong>Screenshots für öffentliche Spielseite</strong><small>Nur ausdrücklich freigegebene Bilder werden veröffentlicht. Shop-/Kauf-Screenshots hier nicht freigeben.</small></div>
      <div class="admin-shot-grid">${(item.screenshots || []).map(s => (s.signedUrl ? `<figure class="admin-shot-item">
        <a target="_blank" rel="noopener" href="${esc(s.signedUrl)}"><img src="${esc(s.signedUrl)}" alt="${esc(s.original_name)}"></a>
        <label class="admin-shot-public-toggle"><input type="checkbox" data-screenshot-public="${esc(s.id)}" ${s.approved_for_public ? 'checked' : ''}><span>Öffentlich freigeben</span></label>
      </figure>` : '')).join('')}</div>
      <details class="submission-details"><summary>Alle Angaben ansehen</summary><div class="detail-grid">
        <div><small>Kurzbeschreibung</small><p>${esc(item.short_description || 'Nicht angegeben')}</p></div>
        <div><small>Ausführliche Beschreibung</small><p>${esc(item.description)}</p></div>
        <div><small>Spielprinzip / Gameplay</small><p>${esc(item.gameplay_description || 'Nicht angegeben')}</p></div>
        <div><small>Funktionen</small><p>${esc(item.features || 'Keine angegeben')}</p></div>
        <div><small>Kontakt</small><p>${esc(item.email)}${item.website ? '<br>' + esc(item.website) : ''}</p></div><div><small>Eingereicht</small><p>${esc(fmtDate(item.submitted_at))}</p></div>
        <div><small>Entwicklerbedingungen</small><p>${item.developer_terms_version ? esc(item.developer_terms_version) + (item.developer_terms_accepted_at ? '<br>' + esc(fmtDate(item.developer_terms_accepted_at)) : '') : 'Altbestand – keine versionierte Zustimmung gespeichert'}</p></div>
        <div><small>Monetarisierungsangabe</small><p>${item.monetization_declaration_accepted_at ? 'Bestätigt<br>' + esc(fmtDate(item.monetization_declaration_accepted_at)) : 'NICHT bestätigt'}</p></div>
        <div><small>Datenschutzangabe</small><p>${item.data_processing_declared ? (safeHttpUrl(item.privacy_policy_url) ? 'Datenverarbeitung angegeben<br><a target="_blank" rel="noopener" href="' + esc(safeHttpUrl(item.privacy_policy_url)) + '">Datenschutzerklärung öffnen</a>' : 'Datenverarbeitung angegeben, Datenschutzerklärung fehlt') : 'Keine Datenverarbeitung angegeben'}</p></div>
        <div><small>Kaufarten</small><p>${Array.isArray(item.monetization_features) && item.monetization_features.length ? esc(item.monetization_features.map(x => monetizationLabels[x] || x).join(', ')) : 'Keine zusätzlichen Kaufarten angegeben'}</p></div>
        <div><small>Sonstige Echtgeldfunktion</small><p>${esc(item.monetization_other_description || 'Nicht angegeben')}</p></div>
        <div><small>Monetarisierungsbedingungen</small><p>${['paid','free_iap'].includes(item.monetization_code) ? (item.payment_terms_accepted_at ? 'Bestätigt<br>' + esc(fmtDate(item.payment_terms_accepted_at)) : 'NICHT bestätigt') : 'Nicht erforderlich'}</p></div>
        <div><small>Monetarisierungsangaben</small><p>${item.monetization_declaration_accepted_at ? 'Vollständigkeit bestätigt<br>' + esc(fmtDate(item.monetization_declaration_accepted_at)) : 'NICHT bestätigt'}</p></div>
        <div><small>Datenschutz des Spiels</small><p>${item.data_processing_declared ? (item.privacy_policy_url ? 'Personenbezogene Daten: Ja<br><a href="' + esc(item.privacy_policy_url) + '" target="_blank" rel="noopener">Datenschutzerklärung öffnen</a>' : 'Personenbezogene Daten: Ja<br>Datenschutzerklärung fehlt') : 'Keine Datenverarbeitung angegeben'}</p></div>
        <div><small>PayPal-Verkäuferkonto</small><p>${['paid','free_iap'].includes(item.monetization_code) ? (item.sellerPayment ? esc(item.sellerPayment.seller_status || 'unbekannt') + (item.sellerPayment.payments_receivable ? '<br>Zahlungsempfang aktiv' : '<br>Zahlungsempfang nicht aktiv') : 'Nicht verbunden') : 'Nicht erforderlich'}</p></div>
      </div></details>
      <label class="review-note"><span>Interne Prüfnotiz</span><textarea data-note rows="3">${esc(item.review_note || '')}</textarea></label>
      <div class="review-actions">
        <button class="button secondary small-button" data-resend-mail type="button">Prüfmail erneut senden</button>
        <button class="button secondary small-button" data-status="review" type="button">In Prüfung</button>
        <button class="button secondary small-button" data-status="correction_required" type="button">Korrektur erforderlich</button>
        <button class="button approve-button small-button" data-status="approved" type="button">Technische Freigabe prüfen</button>
        <button class="button reject-button small-button" data-status="rejected" type="button">Ablehnen</button>
      </div>
    </article>`
    )
    .join('');

  dynamic.querySelectorAll('.submission-card').forEach(card => {
    card.querySelectorAll('[data-status]').forEach(btn =>
      btn.addEventListener('click', async () => {
        const next = btn.dataset.status;
        const id = card.dataset.id;
        const note = card.querySelector('[data-note]').value.trim();
        if (
          next === 'approved' &&
          !confirm(
            'Technische Freigabe prüfen? Ohne fertiges, validiertes Installationsartefakt wird nichts veröffentlicht.'
          )
        )
          return;
        btn.disabled = true;
        try {
          if (next === 'approved') {
            await callAdminRelease({
              submissionId: id,
              reviewNote: note,
            });
          } else {
            await callAdmin({
              action: 'set_status',
              id,
              status: next,
              reviewNote: note,
            });
          }
          await load();
        } catch (e) {
          const messages = {
            artifact_processing_required: 'Die Einreichung kann noch nicht freigegeben werden. Zuerst muss der Package Processor ein validiertes Installationsartefakt erzeugen.',
            release_not_found: 'Der verarbeitete Release-Datensatz fehlt.',
            release_inspection_not_passed: 'Die technische Paketprüfung ist noch nicht bestanden.',
            update_compatibility_failed: 'Das Update ist nicht kompatibel: Paketname, Signatur oder VersionCode passt nicht zum vorherigen Release.',
            update_compatibility_pending: 'Die Update-Kompatibilität ist noch nicht vollständig geprüft.',
            install_artifact_not_ready: 'Das private Android-Installationsartefakt ist noch nicht vollständig validiert.',
            savegame_declaration_required: 'Für dieses Update muss die Savegame-/Datenmigration bestätigt werden.',
            release_validation_checks_incomplete: 'Mindestens eine erforderliche Release-Prüfung ist noch offen.',
            game_record_missing: 'Der interne Game-Datensatz zum Release fehlt.',
            publishing_disabled: 'Veröffentlichungen sind global gesperrt. publishing_enabled ist weiterhin false.',
            approved_status_locked: 'Ein bereits veröffentlichtes Spiel kann nicht nur durch einen Statuswechsel zurückgesetzt werden. Dafür ist ein eigener Entfernungs-/Update-Ablauf nötig.',
            paid_checkout_not_ready: 'Kostenpflichtige Games können noch nicht veröffentlicht werden. Zuerst muss die sichere PayPal-Umsatzaufteilung aktiviert werden.',
            iap_revenue_share_not_ready: 'Games mit In-App-Käufen, Pässen oder Abos können noch nicht veröffentlicht werden. Zuerst muss die GBD-Umsatzaufteilung aktiviert werden.',
            recurring_payments_not_ready: 'Dieses Spiel enthält ein Abo. Wiederkehrende PayPal-Zahlungen sind für Games Behind Doors noch nicht freigeschaltet.',
            payment_terms_missing: 'Die Monetarisierungsbedingungen mit 10-%-GBD-Provision wurden für diese Einreichung nicht bestätigt.',
            terms_reaccept_required: 'Die Entwickler- oder Monetarisierungsbedingungen wurden seit dieser Einreichung aktualisiert. Vor Veröffentlichung ist eine erneute Zustimmung erforderlich.',
            paypal_seller_not_ready: 'Das PayPal-Verkäuferkonto des Entwicklers ist nicht vollständig verbunden oder kann noch keine Zahlungen empfangen.',
            monetization_declaration_missing: 'Die vollständige Angabe aller Kauf-, Abo-, Pass- und Zahlungsfunktionen wurde bei dieser Einreichung nicht bestätigt.',
            privacy_policy_missing: 'Das Spiel verarbeitet personenbezogene Daten, aber es fehlt eine Datenschutzerklärung des Spiels.',
            correction_required: 'Für diese Einreichung ist noch eine Korrektur erforderlich. Erst eine korrigierte Einreichung darf veröffentlicht werden.',
            unsupported_game_file: 'Dieses Dateiformat wird nicht unterstützt. Erlaubt sind APK, ZIP, HTML und HTM.',
            required_artwork_missing: 'Titelbild oder App-Logo fehlt.',
            required_content_missing: 'Version, Kurzbeschreibung, ausführliche Beschreibung oder Gameplay-Angabe fehlt. Vor einer Veröffentlichung müssen alle öffentlichen Game-Inhalte vollständig sein.',
            publishing_closed: 'Veröffentlichungen sind zentral deaktiviert. Das ist im Vorab-/Wartungszustand absichtlich so.',
            publishing_disabled: 'Veröffentlichungen sind zentral deaktiviert. Das ist im Vorab-/Wartungszustand absichtlich so.',
            correction_note_required: 'Für „Korrektur erforderlich“ muss ein konkreter Hinweis gespeichert werden.'
          };
          if (e.message === 'correction_note_required') {
            alert('Bitte zuerst einen Korrekturhinweis eintragen.');
          } else {
            alert(messages[e.message] || ('Fehler: ' + e.message));
          }
        } finally {
          btn.disabled = false;
        }
      })
    );
    card.querySelectorAll('[data-screenshot-public]').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = card.dataset.id;
        const screenshotId = toggle.dataset.screenshotPublic;
        const approved = toggle.checked;
        toggle.disabled = true;
        try {
          await callAdmin({
            action: 'set_screenshot_public',
            submissionId: id,
            screenshotId,
            approved,
          });
        } catch (e) {
          toggle.checked = !approved;
          alert('Screenshot-Freigabe konnte nicht gespeichert werden: ' + e.message);
        } finally {
          toggle.disabled = false;
        }
      });
    });

    const mailButton = card.querySelector('[data-resend-mail]');
    if (mailButton) {
      mailButton.addEventListener('click', async () => {
        const id = card.dataset.id;
        const originalText = mailButton.textContent;
        mailButton.disabled = true;
        mailButton.textContent = 'Wird gesendet…';
        try {
          const result = await callAdmin({ action: 'resend_review_mail', id });
          if (!result?.mail?.sent) throw new Error('Prüfmail konnte nicht gesendet werden');
          alert('Prüfmail wurde erneut gesendet.');
        } catch (e) {
          alert('Fehler beim Mailversand: ' + e.message);
        } finally {
          mailButton.disabled = false;
          mailButton.textContent = originalText;
        }
      });
    }
  });
}
async function load() {
  const data = await callAdmin({ action: 'list' });
  items = data.submissions || [];
  document.getElementById('adminIdentity').textContent =
    'Angemeldet als ' + (data.admin?.email || 'Admin');
  render();
}
async function prepareMfa() {
  mfaMessage.hidden = true;
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  const totpFactors = factors?.totp || [];
  const verified = totpFactors.find(f => f.status === 'verified');
  if (verified) {
    activeFactorId = verified.id;
    enrollingNewFactor = false;
    mfaEnrollBlock.hidden = true;
    document.getElementById('mfaIntro').textContent =
      'Gib den aktuellen Code aus deiner Authenticator-App ein.';
  } else {
    for (const stale of totpFactors.filter(f => f.status !== 'verified')) {
      await client.auth.mfa.unenroll({ factorId: stale.id }).catch(() => {});
    }

    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Games Behind Doors Admin',
    });
    if (error) throw error;
    activeFactorId = data.id;
    enrollingNewFactor = true;
    mfaEnrollBlock.hidden = false;
    mfaQr.src = data.totp.qr_code;
    mfaSecret.textContent = data.totp.secret;
    document.getElementById('mfaIntro').textContent =
      'Richte jetzt einmalig die Zwei-Faktor-Authentifizierung ein.';
  }

  login.hidden = true;
  app.hidden = true;
  mfaSection.hidden = false;
  logoutButton.hidden = false;
}

async function boot() {
  const s = await session();
  if (!s) {
    login.hidden = false;
    mfaSection.hidden = true;
    app.hidden = true;
    logoutButton.hidden = true;
    return;
  }

  login.hidden = true;
  mfaSection.hidden = true;
  app.hidden = false;
  logoutButton.hidden = false;

  try {
    await load();
  } catch (e) {
    if (e.message === 'mfa_required') {
      app.hidden = true;
      await prepareMfa();
    } else if (e.message === 'not_admin') {
      await client.auth.signOut();
      login.hidden = false;
      mfaSection.hidden = true;
      app.hidden = true;
      loginMsg(
        'error',
        'Diese Adresse ist nicht als Games-Behind-Doors-Admin freigeschaltet.'
      );
    } else if (e.message === 'email_not_confirmed') {
      await client.auth.signOut();
      login.hidden = false;
      mfaSection.hidden = true;
      app.hidden = true;
      loginMsg('error', 'Bitte bestätige zuerst die Admin-E-Mail-Adresse.');
    } else {
      alert('Adminbereich konnte nicht geladen werden: ' + e.message);
    }
  }
}
mfaForm?.addEventListener('submit', async e => {
  e.preventDefault();
  mfaMessage.hidden = true;
  const code = mfaCode.value.trim();
  if (!/^[0-9]{6}$/.test(code) || !activeFactorId) {
    mfaMsg('error', 'Bitte einen gültigen 6-stelligen Code eingeben.');
    return;
  }

  const button = mfaForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: activeFactorId,
      code,
    });
    if (error) throw error;
    mfaCode.value = '';
    await client.auth.refreshSession();
    mfaSection.hidden = true;
    await boot();
  } catch (error) {
    mfaMsg('error', 'Code konnte nicht bestätigt werden: ' + error.message);
  } finally {
    button.disabled = false;
  }
});

mfaCancel?.addEventListener('click', async () => {
  if (enrollingNewFactor && activeFactorId) {
    await client.auth.mfa.unenroll({ factorId: activeFactorId }).catch(() => {});
  }
  await client.auth.signOut({ scope: 'local' });
  activeFactorId = null;
  enrollingNewFactor = false;
  mfaSection.hidden = true;
  login.hidden = false;
  app.hidden = true;
  logoutButton.hidden = true;
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginMessage.hidden = true;
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error)
    return loginMsg('error', 'Anmeldung fehlgeschlagen: ' + error.message);
  await boot();
});
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await client.auth.signOut({ scope: 'local' });
    app.hidden = true;
    mfaSection.hidden = true;
    login.hidden = false;
    logoutButton.hidden = true;
    loginPassword.value = '';
    loginMsg('success', 'Abgemeldet.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    alert('Abmelden fehlgeschlagen: ' + e.message);
  } finally {
    logoutButton.disabled = false;
  }
});
document
  .getElementById('refreshAdmin')
  .addEventListener('click', () => load().catch(e => alert(e.message)));
document.getElementById('exportSubmissions').addEventListener('click', () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), submissions: items },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gbd-submissions.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
tabs.forEach(t =>
  t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeFilter = t.dataset.adminFilter || 'all';
    render();
  })
);
client.auth.onAuthStateChange(event => {
  if (event !== 'SIGNED_OUT') return;
  mfaSection.hidden = true;
  app.hidden = true;
  login.hidden = false;
  logoutButton.hidden = true;
});
boot();
