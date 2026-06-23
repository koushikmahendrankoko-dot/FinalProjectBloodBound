/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — auth.js
   Sign in / Create Account / Reset Password logic
   Includes return-path handling for persistent shop sessions.
═══════════════════════════════════════════════════════════════ */

// 1. Force BB to exist immediately so shop.js can find it
window.BB = window.BB || {
  isLoggedIn: () => !!localStorage.getItem('bb_current_user'),
  getCurrentUser: () => localStorage.getItem('bb_current_user'),
  setCurrentUser: (u, remember) => localStorage.setItem('bb_current_user', u),
  logout: () => localStorage.removeItem('bb_current_user'),
  getSaveData: () => JSON.parse(localStorage.getItem('bb_save_data') || '{"bloodCoins": 0, "currentChapter": 1}'),
  saveSaveData: (data) => localStorage.setItem('bb_save_data', JSON.stringify(data))
};

/* ── GOOGLE IDENTITY INITIALIZATION ── */
const GOOGLE_CLIENT_ID = "PASTE_YOUR_REAL_GOOGLE_OAUTH_CLIENT_ID_HERE";

window.onload = function () {
  if (!window.google || !window.google.accounts) {
    console.warn("Google Identity SDK failed to load — Google Sign-In unavailable.");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleSignIn
  });

  const signinBtn = document.getElementById("google-signin-btn");
  if (signinBtn) {
    google.accounts.id.renderButton(signinBtn, {
      theme: "filled_black", size: "large", width: 340,
      text: "signin_with", shape: "rectangular", logo_alignment: "left"
    });
  }

  const signupBtn = document.getElementById("google-signup-btn");
  if (signupBtn) {
    google.accounts.id.renderButton(signupBtn, {
      theme: "filled_black", size: "large", width: 340,
      text: "signup_with", shape: "rectangular", logo_alignment: "left"
    });
  }
};

let currentAuthTab = 'signin';

document.addEventListener('DOMContentLoaded', () => {
  renderSavedAccounts();

  let loggedInUser = localStorage.getItem('bb_current_user');
  if (!loggedInUser && window.BB && typeof window.BB.isLoggedIn === 'function' && window.BB.isLoggedIn()) {
    loggedInUser = window.BB.getCurrentUser();
  }

  if (loggedInUser) {
    showSuccessState(loggedInUser, true);
  }

  const regPw = document.getElementById('reg-password');
  if (regPw) regPw.addEventListener('input', updatePasswordStrength);

  const regUser = document.getElementById('reg-username');
  if (regUser) {
    regUser.addEventListener('input', () => {
      regUser.value = regUser.value.replace(/[^a-zA-Z0-9_]/g, '');
    });
  }
});

/* ── TAB SWITCHING ── */
function switchTab(tab) {
  currentAuthTab = tab;

  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));

  if (tab === 'signin') {
    document.getElementById('tab-signin').classList.add('active');
    document.getElementById('form-signin').classList.add('active');
  } else if (tab === 'register') {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('form-register').classList.add('active');
  } else if (tab === 'forgot') {
    document.getElementById('form-forgot').classList.add('active');
  } else if (tab === 'success') {
    document.getElementById('form-success').classList.add('active');
  }

  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => {
    e.classList.add('hidden');
    e.textContent = '';
  });
}

/* ── PASSWORD VISIBILITY ── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

/* ── PASSWORD STRENGTH METER ── */
function updatePasswordStrength() {
  const pw = document.getElementById('reg-password').value;
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!pw) {
    if (fill) { fill.className = 'strength-fill'; fill.style.width = '0%'; }
    if (label) label.textContent = 'Enter a password';
    return;
  }

  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  let cls, text;
  if (score <= 1) { cls = 'weak'; text = 'Weak'; }
  else if (score === 2) { cls = 'fair'; text = 'Fair'; }
  else if (score === 3 || score === 4) { cls = 'good'; text = 'Good'; }
  else { cls = 'strong'; text = 'Strong'; }

  if (fill) { fill.className = 'strength-fill ' + cls; }
  if (label) label.textContent = text;
}

/* ── SIGN IN VIA EMAIL ── */
function handleEmailSignIn(event) {
  event.preventDefault();
  clearErrors();

  const emailInput = document.getElementById('signin-email');
  const passwordInput = document.getElementById('signin-password');
  const errorEl = document.getElementById('signin-error');
  const submitBtn = document.getElementById('signin-submit');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const remember = document.getElementById('remember-me') ? document.getElementById('remember-me').checked : false;

  if (!email || !password) {
    showError(errorEl, 'Please fill in all fields.');
    return;
  }

  const username = email.split('@')[0];
  setLoading(submitBtn, true);

  setTimeout(() => {
    try {
      if (!window.BB || typeof window.BB.verifyLogin !== 'function') {
        localStorage.setItem('bb_current_user', username);
        setLoading(submitBtn, false);
        showSuccessState(username, false);
        return;
      }

      const result = window.BB.verifyLogin(username, password);
      if (!result || !result.success) {
        setLoading(submitBtn, false);
        showError(errorEl, (result && result.error) ? result.error : 'Invalid email or password.');
        shakeForm('form-signin');
        return;
      }

      window.BB.setCurrentUser(result.username, remember);
      localStorage.setItem('bb_current_user', result.username);
      setLoading(submitBtn, false);
      showSuccessState(result.username, false);

    } catch (error) {
      setLoading(submitBtn, false);
      localStorage.setItem('bb_current_user', username);
      showSuccessState(username, false);
    }
  }, 500);
}

/* ── REGISTER VIA EMAIL ── */
function handleEmailRegister(event) {
  event.preventDefault();
  clearErrors();

  const usernameInput = document.getElementById('reg-username');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const confirmInput = document.getElementById('reg-confirm');
  const errorEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (username.length < 3 || username.length > 20) {
    showError(errorEl, 'Username must be 3–20 characters.');
    return;
  }
  if (password !== confirm) {
    showError(errorEl, 'Passwords do not match.');
    return;
  }

  setLoading(submitBtn, true);

  setTimeout(() => {
    try {
      if (!window.BB || typeof window.BB.createAccount !== 'function') {
        localStorage.setItem('bb_current_user', username);
        setLoading(submitBtn, false);
        showSuccessState(username, false, true);
        return;
      }

      const result = window.BB.createAccount(username, password);
      if (!result || !result.success) {
        setLoading(submitBtn, false);
        showError(errorEl, result.error || 'Account creation failed.');
        return;
      }

      window.BB.setCurrentUser(username, true);
      localStorage.setItem('bb_current_user', username);
      setLoading(submitBtn, false);
      showSuccessState(username, false, true);
    } catch (error) {
      localStorage.setItem('bb_current_user', username);
      setLoading(submitBtn, false);
      showSuccessState(username, false, true);
    }
  }, 600);
}

/* ── GOOGLE AUTH HANDLER ── */
function handleGoogleSignIn(response) {
  const base64Url = response.credential.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  const googleUser = JSON.parse(jsonPayload);
  
  const username = (googleUser.name || "user").replace(/[^a-zA-Z0-9_]/g, ''); 
  localStorage.setItem('bb_current_user', username);
  if (window.BB) window.BB.setCurrentUser(username, true);

  showSuccessState(username, false, false);
}

/* ── SUCCESS STATE PANEL (WITH REDIRECT LOGIC) ── */
function showSuccessState(username, alreadyLoggedIn, isNewAccount) {
  // --- REDIRECT LOGIC ---
  const returnPath = localStorage.getItem('auth_return_path');
  if (returnPath) {
    localStorage.removeItem('auth_return_path');
    window.location.href = returnPath;
    return;
  }
  // ----------------------

  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
  
  const successPanel = document.getElementById('form-success');
  if (successPanel) successPanel.classList.add('active');

  const title = document.getElementById('success-title');
  const msg = document.getElementById('success-msg');
  const userInfo = document.getElementById('success-user-info');
  const previewImg = document.getElementById('avatar-pic');

  if (isNewAccount) {
    if (title) title.textContent = 'Account Created!';
    if (msg) msg.textContent = 'Your blood rune has been bound.';
  } else {
    if (title) title.textContent = 'Character Profile';
  }

  if (previewImg) {
    const savedAvatar = localStorage.getItem(`bb_avatar_${username}`);
    previewImg.src = savedAvatar ? savedAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
  }

  if (window.BB && typeof window.BB.getProgressSummary === 'function') {
    const progress = window.BB.getProgressSummary(username);
    if (userInfo) {
      userInfo.innerHTML = `<div style="text-align:left; color:#fff;">👤 Player: <strong>${escapeHtml(username)}</strong></div>`;
    }
  }
}

/* ── HELPERS ── */
function logoutSession() {
  localStorage.removeItem('bb_current_user');
  if (window.BB) window.BB.logout();
  switchTab('signin');
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
}

function showError(el, message) {
  el.textContent = '⚠ ' + message;
  el.classList.remove('hidden');
}

function shakeForm(formId) {
  const form = document.getElementById(formId);
  if (form) form.style.animation = 'shake-form .4s ease';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSavedAccounts() {}