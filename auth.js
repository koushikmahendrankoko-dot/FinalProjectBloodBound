/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — auth.js
   Sign in / Create Account / Reset Password logic
═══════════════════════════════════════════════════════════════ */

/* ── GOOGLE IDENTITY INITIALIZATION ── */
window.onload = function () {
  google.accounts.id.initialize({
    client_id: "881716006091-o7ork239fc5o224b2oduajfnggsherd9.apps.googleusercontent.com",
    callback: handleGoogleSignIn
  });
  const signinBtn = document.getElementById("google-signin-btn");
  if (signinBtn) {
    google.accounts.id.renderButton(signinBtn, { theme: "filled_black", size: "large", width: "340" });
  }
};

let currentAuthTab = 'signin';

document.addEventListener('DOMContentLoaded', () => {
  renderSavedAccounts();

  // If already logged in, show profile panel view immediately
  let loggedInUser = localStorage.getItem('bb_current_user');
  if (!loggedInUser && window.BB && typeof window.BB.isLoggedIn === 'function' && window.BB.isLoggedIn()) {
    loggedInUser = window.BB.getCurrentUser();
  }

  if (loggedInUser) {
    showSuccessState(loggedInUser, true);
  }

  // Live password strength meter
  const regPw = document.getElementById('reg-password');
  if (regPw) regPw.addEventListener('input', updatePasswordStrength);

  // Username sanitization (letters/numbers only) on register
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

/* ── PASSWORD VISIBILITY TOGGLE ── */
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
        console.warn("window.BB engine not detected. Using simulation fallback.");
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
      console.error("Auth Engine Intercepted Error:", error);
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

  if (!usernameInput || !emailInput || !passwordInput || !confirmInput) return;

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (username.length < 3 || username.length > 20) {
    showError(errorEl, 'Username must be 3–20 characters.');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showError(errorEl, 'Username can only contain letters, numbers, and underscores.');
    return;
  }
  if (password.length < 8) {
    showError(errorEl, 'Password must be at least 8 characters.');
    return;
  }
  if (password !== confirm) {
    showError(errorEl, 'Passwords do not match.');
    return;
  }

  setLoading(submitBtn, true);

  setTimeout(() => {
    try {
      if (!window.BB || typeof window.BB.accountExists !== 'function') {
        localStorage.setItem('bb_current_user', username);
        setLoading(submitBtn, false);
        showSuccessState(username, false, true);
        return;
      }

      if (window.BB.accountExists(username)) {
        setLoading(submitBtn, false);
        showError(errorEl, 'That username is already taken. Try another.');
        return;
      }

      const result = window.BB.createAccount(username, password);

      if (!result || !result.success) {
        setLoading(submitBtn, false);
        showError(errorEl, (result && result.error) ? result.error : 'Account creation failed.');
        return;
      }

      window.BB.setCurrentUser(username, true);
      localStorage.setItem('bb_current_user', username);
      setLoading(submitBtn, false);
      showSuccessState(username, false, true);

    } catch (error) {
      console.error("Registration Engine Error:", error);
      localStorage.setItem('bb_current_user', username);
      setLoading(submitBtn, false);
      showSuccessState(username, false, true);
    }
  }, 600);
}

/* ── GOOGLE AUTHENTICATION TOKEN PARSER ── */
function handleGoogleSignIn(response) {
  if (!response || !response.credential) {
    console.error("Google Auth Error: No credential received.");
    return;
  }
  try {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const googleUser = JSON.parse(jsonPayload);
    
    const username = (googleUser.name || "user").replace(/[^a-zA-Z0-9_]/g, ''); 
    const profilePicUrl = googleUser.picture;

    localStorage.setItem('bb_current_user', username);
    localStorage.setItem(`bb_avatar_${username}`, profilePicUrl);

    if (window.BB && typeof window.BB.setCurrentUser === 'function') {
      window.BB.setCurrentUser(username, true);
    }

    showSuccessState(username, false, false);

  } catch (error) {
    console.error("Secure Identity Parsing Exception:", error);
    alert("Google Sign-In failed to capture authorization elements.");
  }
}

/* ── PROFILE CUSTOMIZATION LOGIC ── */
function toggleAvatarInput() {
  const inputWrap = document.getElementById('avatar-url-wrap');
  if (inputWrap) inputWrap.classList.toggle('hidden');
}

function saveCustomAvatar() {
  const username = localStorage.getItem('bb_current_user') || 'default_user';
  const urlInput = document.getElementById('custom-avatar-url');
  if (!urlInput || !urlInput.value.trim()) return;

  const newImageUrl = urlInput.value.trim();
  localStorage.setItem(`bb_avatar_${username}`, newImageUrl);
  
  const previewImg = document.getElementById('avatar-pic');
  if (previewImg) {
    previewImg.src = newImageUrl;
  }
  
  toggleAvatarInput();
}

function saveUserBio() {
  const username = localStorage.getItem('bb_current_user') || 'default_user';
  const bioTextarea = document.getElementById('user-bio-text');
  if (!bioTextarea) return;

  localStorage.setItem(`bb_bio_${username}`, bioTextarea.value);
  alert("Character bio updated successfully!");
}

function logoutSession() {
  localStorage.removeItem('bb_current_user');
  if (window.BB && typeof window.BB.logout === 'function') {
    window.BB.logout();
  }
  switchTab('signin');
}

/* ── SUCCESS STATE PANEL RENDERING ── */
function showSuccessState(username, alreadyLoggedIn, isNewAccount) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
  
  const successPanel = document.getElementById('form-success');
  if (successPanel) successPanel.classList.add('active');

  const title = document.getElementById('success-title');
  const msg = document.getElementById('success-msg');
  const userInfo = document.getElementById('success-user-info');
  const bioTextarea = document.getElementById('user-bio-text');
  const previewImg = document.getElementById('avatar-pic');

  if (isNewAccount) {
    if (title) title.textContent = 'Account Created!';
    if (msg) msg.textContent = 'Your blood rune has been bound. The curse begins now.';
  } else {
    if (title) title.textContent = 'Character Profile';
    if (msg) msg.textContent = 'Welcome back. Modifying player properties.';
  }

  if (previewImg) {
    const savedAvatar = localStorage.getItem(`bb_avatar_${username}`);
    previewImg.src = savedAvatar ? savedAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
  }

  if (bioTextarea) {
    const savedBio = localStorage.getItem(`bb_bio_${username}`);
    bioTextarea.value = savedBio ? savedBio : '';
  }

  if (window.BB && typeof window.BB.getProgressSummary === 'function') {
    try {
      const progress = window.BB.getProgressSummary(username);
      if (userInfo) {
        userInfo.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px; color: #fff; background: rgba(255,62,62,0.08); padding: 10px; border: 1px solid rgba(255,62,62,0.2); border-radius: 4px; text-align: left;">
            <div style="font-size: 1.1em;">👤 Player: <strong>${escapeHtml(username)}</strong></div>
            <div style="font-size:.85em; color:#aaa;">Chapter ${progress.chapter || 1} — ${progress.chapterName || 'The Awakening'}</div>
            <div style="font-size:.85em; color:#aaa;">🩸 ${progress.bloodCoins || 0} Blood Coins</div>
          </div>
        `;
      }
    } catch(e) {
      if (userInfo) userInfo.innerHTML = `<div style="text-align:left; color:#fff; font-size:1.1em;">👤 Player: <strong>${escapeHtml(username)}</strong></div>`;
    }
  } else {
    if (userInfo) {
      userInfo.innerHTML = `<div style="text-align:left; color:#fff; font-size:1.1em;">👤 Player: <strong>${escapeHtml(username)}</strong></div>`;
    }
  }
}

/* ── ADDITIONAL AUTH HANDLERS ── */
showForgotPassword = (e) => { e.preventDefault(); switchTab('forgot'); }
handleForgotPassword = (e) => { e.preventDefault(); switchTab('signin'); }
function renderSavedAccounts() {}

function showError(el, message) {
  if (!el) return;
  el.textContent = '⚠ ' + message;
  el.classList.remove('hidden');
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loading = btn.querySelector('.btn-loading');
  if (isLoading) {
    if (text) text.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    btn.disabled = true;
  } else {
    if (text) text.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    btn.disabled = false;
  }
}

function shakeForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.style.animation = 'none';
  requestAnimationFrame(() => { form.style.animation = 'shake-form .4s ease'; });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

(function injectShakeKeyframes() {
  if (document.getElementById('shake-style-frame')) return;
  const style = document.createElement('style');
  style.id = 'shake-style-frame';
  style.textContent = `@keyframes shake-form { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }`;
  document.head.appendChild(style);
})();