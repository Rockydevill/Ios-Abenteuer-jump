const PROJECT_URL = 'https://voldtqsdqcdexkexwerp.supabase.co';
const PUBLISHABLE_KEY = ["sb_publish","able_2CqwT","ZnV0S35nNa","KyoEyxw_PS","Tw9_Pk"].join('');
const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);

const form = document.getElementById('developerLoginForm');
const emailInput = document.getElementById('developerLoginEmail');
const passwordInput = document.getElementById('developerLoginPassword');
const googleLoginButton = document.getElementById('developerGoogleLogin');
const forgotPasswordButton = document.getElementById('developerForgotPassword');
const resendConfirmationButton = document.getElementById('developerResendConfirmation');
const message = document.getElementById('developerLoginMessage');

function showMessage(type, text) {
  message.hidden = false;
  message.className = 'form-message ' + type;
  message.textContent = text;
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

client.auth.onAuthStateChange(async event => {
  if (event !== 'SIGNED_IN') return;
  const { data } = await client.auth.getUser();
  if (data.user?.email_confirmed_at) location.replace('/developers/portal/');
});

redirectIfSignedIn().catch(() => {
  showMessage('error', 'Anmeldung konnte nicht vorbereitet werden.');
});