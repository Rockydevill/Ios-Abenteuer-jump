(() => {
  'use strict';

  const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
  const FIXTURE_URL = PROJECT_URL + '/functions/v1/gbd-test-fixtures-admin';
  const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);

  const ownerState = document.getElementById('ownerState');
  const output = document.getElementById('statusOutput');
  const message = document.getElementById('message');
  const form = document.getElementById('provisionForm');
  const cleanupButton = document.getElementById('cleanupButton');
  const refreshButton = document.getElementById('refreshStatus');

  function show(type, text) {
    message.classList.remove('hidden', 'ok', 'bad');
    message.classList.add(type === 'success' ? 'ok' : 'bad');
    message.textContent = text;
  }

  function clearPasswords() {
    for (const id of ['adminPassword', 'sellerPassword', 'guestPassword']) {
      document.getElementById(id).value = '';
    }
  }

  function renderStatus(data) {
    const clean = {
      admin: data.admin || null,
      seller: data.seller || null,
      guest: data.guest || null,
      testGame: data.testGame || null
    };
    output.textContent = JSON.stringify(clean, null, 2);
  }

  async function getOwnerSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error('owner_login_required');

    const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal?.currentLevel !== 'aal2') throw new Error('owner_mfa_required');

    ownerState.textContent = 'Owner-Sitzung aktiv: ' + (session.user?.email || 'angemeldet') + ' • 2FA bestätigt';
    return session;
  }

  async function callFixtures(body) {
    const session = await getOwnerSession();
    const response = await fetch(FIXTURE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + session.access_token
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || ('HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function explain(error) {
    const map = {
      owner_login_required: 'Kein Owner-Login gefunden. Öffne zuerst den normalen Staging-Adminbereich und melde dich mit deinem echten Owner-Konto an.',
      owner_mfa_required: 'Owner-2FA ist noch nicht bestätigt. Öffne zuerst den Staging-Adminbereich und bestätige dort den Authenticator-Code.',
      mfa_required: 'Owner-2FA ist noch nicht bestätigt.',
      owner_admin_required: 'Diese Sitzung gehört nicht zum Owner-Admin.',
      invalid_auth: 'Die Admin-Sitzung ist ungültig oder abgelaufen.',
      test_passwords_invalid: 'Alle drei Testpasswörter müssen zwischen 12 und 128 Zeichen lang sein.',
      server_error: 'Der Test-Backend-Aufruf ist fehlgeschlagen. Es wurden keine öffentlichen Freigaben verändert.'
    };
    return map[error.message] || ('Fehler: ' + error.message);
  }

  async function loadStatus() {
    refreshButton.disabled = true;
    try {
      const data = await callFixtures({ action: 'status' });
      renderStatus(data);
      show('success', 'Interner Teststatus geladen.');
    } catch (error) {
      ownerState.textContent = explain(error);
      show('error', explain(error));
    } finally {
      refreshButton.disabled = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('provisionButton');
    button.disabled = true;
    const payload = {
      action: 'provision',
      adminPassword: document.getElementById('adminPassword').value,
      sellerPassword: document.getElementById('sellerPassword').value,
      guestPassword: document.getElementById('guestPassword').value
    };
    try {
      if (payload.adminPassword.length < 12 || payload.sellerPassword.length < 12 || payload.guestPassword.length < 12) {
        throw new Error('test_passwords_invalid');
      }
      const data = await callFixtures(payload);
      renderStatus(data);
      show('success', 'Test-Admin, Test-Entwickler, Test-Gast und Testspiel sind angelegt bzw. aktualisiert.');
    } catch (error) {
      show('error', explain(error));
    } finally {
      payload.adminPassword = '';
      payload.sellerPassword = '';
      payload.guestPassword = '';
      clearPasswords();
      button.disabled = false;
    }
  });

  cleanupButton.addEventListener('click', async () => {
    if (!confirm('Wirklich NUR die internen Testkonten und das Testspiel löschen?')) return;
    cleanupButton.disabled = true;
    try {
      const data = await callFixtures({ action: 'cleanup' });
      renderStatus(data);
      show('success', 'Interne Testdaten wurden entfernt. Echtes Owner-Konto und normale Konten blieben unberührt.');
    } catch (error) {
      show('error', explain(error));
    } finally {
      cleanupButton.disabled = false;
    }
  });

  refreshButton.addEventListener('click', loadStatus);
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      ownerState.textContent = 'Owner-Sitzung wurde abgemeldet.';
      show('error', 'Melde dich zuerst wieder im Staging-Adminbereich an.');
    }
  });

  loadStatus();
})();
