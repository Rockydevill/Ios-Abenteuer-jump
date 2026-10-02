const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY = ["sb_publish","able_2CqwT","ZnV0S35nNa","KyoEyxw_PS","Tw9_Pk"].join('');
const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
const PUBLIC_CONFIG_URL = PROJECT_URL + '/functions/v1/gbd-public-config';
const DEVELOPER_SIGNUP_URL = PROJECT_URL + '/functions/v1/gbd-developer-signup';

const form = document.getElementById('developerLoginForm');
const emailInput = document.getElementById('developerLoginEmail');
const passwordInput = document.getElementById('developerLoginPassword');
const googleLoginButton = document.getElementById('developerGoogleLogin');
const forgotPasswordButton = document.getElementById('developerForgotPassword');
const resendConfirmationButton = document.getElementById('developerResendConfirmation');
const message = document.getElementById('developerLoginMessage');
const registrationState = document.getElementById('developerRegistrationState');
const registrationCard = document.getElementById('developerRegistrationCard');
const registrationForm = document.getElementById('developerRegistrationForm');
const registrationMessage = document.getElementById('developerRegistrationMessage');
const registerUsername = document.getElementById('developerRegisterUsername');
const registerEmail = document.getElementById('developerRegisterEmail');
const registerPassword = document.getElementById('developerRegisterPassword');
const registerCountry = document.getElementById('developerRegisterCountry');
const registerCountryConfirm = document.getElementById('developerRegisterCountryConfirm');
const registerTerms = document.getElementById('developerRegisterTerms');
const registerButton = document.getElementById('developerRegisterButton');

const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];

function showMessage(type, text) {
  message.hidden = false;
  message.className = 'form-message ' + type;
  message.textContent = text;
}
function showRegistrationMessage(type, text) {
  if (!registrationMessage) return;
  registrationMessage.hidden = false;
  registrationMessage.className = 'form-message ' + type;
  registrationMessage.textContent = text;
}
function populateEuCountries() {
  if (!registerCountry || registerCountry.options.length > 1) return;
  const names = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['de'], { type: 'region' })
    : null;
  for (const code of EU_COUNTRIES) {
    const option = document.createElement('option');
    option.value = code;
    let label = code;
    try { label = names?.of(code) || code; } catch {}
    option.textContent = label + ' (' + code + ')';
    registerCountry.appendChild(option);
  }
}
async function loadRegistrationState() {
  try {
    const r = await fetch(PUBLIC_CONFIG_URL, { headers: { apikey: PUBLISHABLE_KEY }, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    const enabled = r.ok && d.developerRegistrationEnabled === true;
    if (registrationCard) registrationCard.hidden = !enabled;
    if (registrationState) {
      registrationState.textContent = enabled
        ? 'Neue Entwicklerkonten können für EU-Wohn- oder Unternehmenssitze registriert werden. E-Mail-Bestätigung und serverseitige Länderprüfung sind erforderlich.'
        : 'Neue Entwicklerregistrierungen sind derzeit geschlossen. Bereits freigeschaltete Konten können sich weiterhin anmelden.';
    }
    if (enabled) populateEuCountries();
  } catch {
    if (registrationCard) registrationCard.hidden = true;
  }
}

async function redirectIfSignedIn() {
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return;

  const { data: userData, error } = await client.auth.getUser();
  const user = userData?.user;
  if (error || !user?.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' });
    return;
  }
  location.replace('/developers/portal/');
}

googleLoginButton?.addEventListener('click', async () => {
  message.hidden = true;
  googleLoginButton.disabled = true;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + '/developers/portal/',
    },
  });

  if (error) {
    googleLoginButton.disabled = false;
    showMessage('error', 'Google-Anmeldung konnte nicht gestartet werden: ' + error.message);
  }
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  message.hidden = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage('error', 'Anmeldung fehlgeschlagen: ' + error.message);
    return;
  }

  if (!data.user?.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' });
    showMessage('error', 'Bitte bestätige zuerst deine E-Mail-Adresse.');
    return;
  }

  passwordInput.value = '';
  location.replace('/developers/portal/');
});

forgotPasswordButton?.addEventListener('click', async () => {
  message.hidden = true;
  const email = emailInput.value.trim();
  if (!email) {
    showMessage('error', 'Bitte zuerst deine E-Mail-Adresse eingeben.');
    return;
  }

  forgotPasswordButton.disabled = true;
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/developers/reset-password/',
    });
    if (error) throw error;
    showMessage('success', 'Wenn ein Konto zu dieser Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts versendet.');
  } catch (error) {
    showMessage('error', 'Passwort-Mail konnte nicht angefordert werden: ' + error.message);
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

resendConfirmationButton?.addEventListener('click', async () => {
  message.hidden = true;
  const email = emailInput.value.trim();
  if (!email) {
    showMessage('error', 'Bitte zuerst deine E-Mail-Adresse eingeben.');
    return;
  }

  resendConfirmationButton.disabled = true;
  try {
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
    showMessage('success', 'Wenn die Adresse noch bestätigt werden muss, wurde die Bestätigungs-Mail erneut angefordert.');
  } catch (error) {
    showMessage('error', 'Bestätigungs-Mail konnte nicht angefordert werden: ' + error.message);
  } finally {
    resendConfirmationButton.disabled = false;
  }
});

registrationForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (registrationMessage) registrationMessage.hidden = true;
  if (!registrationForm.checkValidity()) {
    registrationForm.reportValidity();
    return;
  }
  registerButton.disabled = true;
  try {
    const r = await fetch(DEVELOPER_SIGNUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY },
      body: JSON.stringify({
        username: registerUsername.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value,
        declaredCountryCode: registerCountry.value,
        countryConfirmed: registerCountryConfirm.checked,
        developerTermsAccepted: registerTerms.checked
      })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const messages = {
        developer_registration_closed: 'Neue Entwicklerregistrierungen sind derzeit geschlossen.',
        developer_age_policy_review_required: 'Die Altersregel für kostenlose Entwicklerkonten ist noch nicht abschließend freigegeben. Die Registrierung bleibt bis dahin geschlossen.',
        country_not_supported: 'Für deinen Staat ist diese Funktion nicht verfügbar.',
        country_verification_required: 'Dein Land konnte für diese Funktion nicht eindeutig bestätigt werden. Bitte prüfe deine Angaben oder wende dich an den Support.',
        country_required: 'Bitte wähle ein EU-Land aus.',
        country_confirmation_required: 'Bitte bestätige die Länderangabe.',
        developer_terms_required: 'Bitte akzeptiere die Entwicklerbedingungen.',
        rate_limited: 'Zu viele Registrierungsversuche. Bitte später erneut versuchen.'
      };
      throw new Error(messages[d.error] || d.message || d.error || 'Registrierung fehlgeschlagen');
    }
    registerPassword.value = '';
    showRegistrationMessage('success', d.message || 'Bitte bestätige deine E-Mail-Adresse.');
  } catch (error) {
    showRegistrationMessage('error', error.message || 'Registrierung fehlgeschlagen.');
  } finally {
    registerButton.disabled = false;
  }
});

client.auth.onAuthStateChange(async event => {
  if (event !== 'SIGNED_IN') return;
  const { data } = await client.auth.getUser();
  if (data.user?.email_confirmed_at) location.replace('/developers/portal/');
});

loadRegistrationState();
redirectIfSignedIn().catch(() => {
  showMessage('error', 'Anmeldung konnte nicht vorbereitet werden.');
});