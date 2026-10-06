(() => {
  'use strict';

  const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_2CqwTZnV0S35nNaKyoEyxw_PSTw9_Pk';
  const ADMIN_URL = PROJECT_URL + '/functions/v1/gbd-mail-config-admin';
  const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);

  const ownerState = document.getElementById('ownerState');
  const smtpState = document.getElementById('smtpState');
  const message = document.getElementById('message');
  const smtpForm = document.getElementById('smtpForm');
  const testForm = document.getElementById('testForm');
  const deleteButton = document.getElementById('deleteButton');
  const refreshButton = document.getElementById('refreshStatus');

  function show(type, text) {
    message.classList.remove('hidden', 'ok', 'bad');
    message.classList.add(type === 'success' ? 'ok' : 'bad');
    message.textContent = text;
  }

  function renderStatus(data) {
    if (data.configured) {
      smtpState.textContent = 'Eingerichtet: ' + data.username + ' • Absender: ' + (data.fromName || 'Games Behind Doors') + (data.updatedAt ? ' • geändert: ' + new Date(data.updatedAt).toLocaleString() : '');
      document.getElementById('smtpUsername').value = data.username || '';
      document.getElementById('fromName').value = data.fromName || 'Games Behind Doors';
    } else {
      smtpState.textContent = 'Noch kein STRATO-SMTP-Zugang gespeichert.';
    }
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

  async function callAdmin(body) {
    const session = await getOwnerSession();
    const response = await fetch(ADMIN_URL, {
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
      owner_login_required: 'Kein Owner-Login gefunden. Öffne zuerst den Staging-Adminbereich und melde dich mit deinem echten Owner-Konto an.',
      owner_mfa_required: 'Owner-2FA ist noch nicht bestätigt. Öffne zuerst den Staging-Adminbereich und bestätige dort deinen Authenticator-Code.',
      mfa_required: 'Owner-2FA ist noch nicht bestätigt.',
      owner_admin_required: 'Diese Sitzung gehört nicht zum Owner-Admin.',
      invalid_auth: 'Die Admin-Sitzung ist ungültig oder abgelaufen.',
      invalid_smtp_username: 'Bitte eine echte STRATO-Mailbox unter @gamesbehinddoors.de eintragen.',
      invalid_smtp_password: 'Das Mailbox-Passwort fehlt oder ist ungültig.',
      invalid_recipient: 'Die Empfängeradresse der Testmail ist ungültig.',
      smtp_not_configured: 'STRATO SMTP ist noch nicht eingerichtet.',
      mail_delivery_failed: 'SMTP-Anmeldung oder Mailversand ist fehlgeschlagen. Prüfe Mailbox und Mailbox-Passwort.',
      server_error: 'Der Mail-Backend-Aufruf ist fehlgeschlagen. Keine öffentliche Freigabe wurde verändert.'
    };
    return map[error.message] || ('Fehler: ' + error.message);
  }

  async function loadStatus() {
    refreshButton.disabled = true;
    try {
      const data = await callAdmin({ action: 'status' });
      renderStatus(data);
      show('success', data.configured ? 'STRATO-Mailkonfiguration geladen.' : 'Mailbereich ist bereit. Es fehlen nur noch die STRATO-Mailbox-Zugangsdaten.');
    } catch (error) {
      ownerState.textContent = explain(error);
      show('error', explain(error));
    } finally {
      refreshButton.disabled = false;
    }
  }

  smtpForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('saveButton');
    const passwordInput = document.getElementById('smtpPassword');
    button.disabled = true;
    const payload = {
      action: 'save',
      username: document.getElementById('smtpUsername').value.trim(),
      password: passwordInput.value,
      fromName: document.getElementById('fromName').value.trim()
    };
    try {
      const data = await callAdmin(payload);
      renderStatus(data);
      show('success', 'STRATO-Mailbox wurde verschlüsselt gespeichert. Jetzt die Testmail senden.');
    } catch (error) {
      show('error', explain(error));
    } finally {
      payload.password = '';
      passwordInput.value = '';
      button.disabled = false;
    }
  });

  testForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('testButton');
    button.disabled = true;
    try {
      await callAdmin({ action: 'test', to: document.getElementById('testRecipient').value.trim() });
      show('success', 'Testmail wurde vom STRATO-SMTP-Server angenommen. Prüfe jetzt den Posteingang.');
    } catch (error) {
      show('error', explain(error));
    } finally {
      button.disabled = false;
    }
  });

  deleteButton.addEventListener('click', async () => {
    if (!confirm('Gespeicherte STRATO-Mailbox-Zugangsdaten wirklich löschen?')) return;
    deleteButton.disabled = true;
    try {
      const data = await callAdmin({ action: 'delete' });
      renderStatus(data);
      document.getElementById('smtpUsername').value = '';
      document.getElementById('smtpPassword').value = '';
      show('success', 'Gespeicherter SMTP-Zugang wurde gelöscht.');
    } catch (error) {
      show('error', explain(error));
    } finally {
      deleteButton.disabled = false;
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
