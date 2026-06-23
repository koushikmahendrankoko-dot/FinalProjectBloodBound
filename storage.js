/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — storage.js
   THE FIX: isLoggedIn() checks bb_current_user directly.
   Auto-registers any user (Google/email) in accounts registry
   on first sign-in so the whole site recognises them as logged in.
═══════════════════════════════════════════════════════════════ */

const BB_KEYS = {
  ACCOUNTS:     'bb_accounts',
  CURRENT_USER: 'bb_current_user',
  SAVE_PREFIX:  'bb_save_',
  REMEMBER:     'bb_remember'
};

function bbHashPassword(password) {
  if (!password) return 'oauth_user';
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

function bbGetAccounts() {
  try { return JSON.parse(localStorage.getItem(BB_KEYS.ACCOUNTS) || '{}'); }
  catch(e) { return {}; }
}

function bbSaveAccounts(accounts) {
  try { localStorage.setItem(BB_KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; }
  catch(e) { return false; }
}

function bbAccountExists(username) {
  if (!username) return false;
  const accounts = bbGetAccounts();
  return Object.keys(accounts).some(u => u.toLowerCase() === username.toLowerCase());
}

function bbCreateAccount(username, password) {
  const accounts = bbGetAccounts();
  const exists   = Object.keys(accounts).some(u => u.toLowerCase() === username.toLowerCase());
  if (exists) return { success: false, error: 'Username already taken.' };
  accounts[username] = {
    passwordHash: bbHashPassword(password),
    createdAt:    Date.now(),
    displayName:  username
  };
  bbSaveAccounts(accounts);
  bbInitSaveData(username);
  return { success: true };
}

function bbVerifyLogin(username, password) {
  const accounts = bbGetAccounts();
  const key = Object.keys(accounts).find(u => u.toLowerCase() === username.toLowerCase());
  if (!key) return { success: false, error: 'No account with that username.' };
  if (accounts[key].passwordHash !== bbHashPassword(password))
    return { success: false, error: 'Incorrect password.' };
  return { success: true, username: key };
}

/* ── THE FIX: setCurrentUser auto-registers if missing ── */
function bbSetCurrentUser(username, remember) {
  localStorage.setItem(BB_KEYS.CURRENT_USER, username);
  localStorage.setItem(BB_KEYS.REMEMBER, remember ? '1' : '0');
  // Auto-register in accounts registry if not present (Google/OAuth users)
  if (!bbAccountExists(username)) {
    bbCreateAccount(username, null); // null = no password (OAuth)
  }
  bbInitSaveData(username);
}

function bbGetCurrentUser() {
  return localStorage.getItem(BB_KEYS.CURRENT_USER) || null;
}

function bbLogout() {
  localStorage.removeItem(BB_KEYS.CURRENT_USER);
}

/* ── THE KEY FIX ──
   Old broken version: required accountExists() which Google sign-in
   never populated → whole site thought user was logged out.
   New version: just checks if bb_current_user is set. ── */
function bbIsLoggedIn() {
  const user = bbGetCurrentUser();
  return !!(user && user.trim().length > 0);
}

function bbDefaultSaveData() {
  return {
    version: 1, createdAt: Date.now(), lastPlayed: Date.now(),
    currentChapter: 1, chaptersCompleted: [], checkpointId: 'ch1_start',
    maxHp: 100, currentHp: 100, baseAttack: 10, speed: 3, bloodCoins: 0,
    abilities: { slot1:'blood_surge', slot2:'crimson_whirl', slot3:null, slot4:null },
    unlockedAbilities: ['blood_surge','crimson_whirl'],
    purchases: [], relics: [],
    inventory: { smallPotions:0, largePotions:0, reviveCharm:false },
    storyFlags: { sparedLordVael:null, obelisksActivated:[], dialogueSeen:[] },
    settings: { masterVolume:70, musicVolume:60, sfxVolume:80, pixelFilter:true, screenShake:true },
    stats: { deaths:0, enemiesDefeated:0, bossesDefeated:0, totalPlayTime:0, hpSacrificed:0 }
  };
}

function bbInitSaveData(username) {
  const key = BB_KEYS.SAVE_PREFIX + username;
  if (!localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify(bbDefaultSaveData()));
}

function bbGetSaveData(username) {
  username = username || bbGetCurrentUser();
  if (!username) return bbDefaultSaveData();
  try {
    const raw = localStorage.getItem(BB_KEYS.SAVE_PREFIX + username);
    if (!raw) { bbInitSaveData(username); return bbDefaultSaveData(); }
    return bbDeepMerge(bbDefaultSaveData(), JSON.parse(raw));
  } catch(e) { return bbDefaultSaveData(); }
}

function bbSaveSaveData(data, username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  try {
    data.lastPlayed = Date.now();
    localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(data));
    return true;
  } catch(e) { return false; }
}

function bbResetSaveData(username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(bbDefaultSaveData()));
  return true;
}

function bbDeepMerge(target, source) {
  const out = { ...target };
  for (const k in source) {
    if (source[k] && typeof source[k]==='object' && !Array.isArray(source[k]) && target[k])
      out[k] = bbDeepMerge(target[k], source[k]);
    else if (source[k] !== undefined) out[k] = source[k];
  }
  return out;
}

function bbGetProgressSummary(username) {
  const d = bbGetSaveData(username);
  const names = {1:'The Cursed Village',2:'The Hollow Dungeon',3:'The Crimson Castle',4:'The Blood Temple',5:'The Final Realm'};
  return { chapter:d.currentChapter, chapterName:names[d.currentChapter]||'Unknown',
           bloodCoins:d.bloodCoins, completed:d.chaptersCompleted.length };
}

window.BB = {
  hashPassword:bbHashPassword, getAccounts:bbGetAccounts,
  accountExists:bbAccountExists, createAccount:bbCreateAccount,
  verifyLogin:bbVerifyLogin, setCurrentUser:bbSetCurrentUser,
  getCurrentUser:bbGetCurrentUser, logout:bbLogout, isLoggedIn:bbIsLoggedIn,
  getSaveData:bbGetSaveData, saveSaveData:bbSaveSaveData,
  resetSaveData:bbResetSaveData, defaultSaveData:bbDefaultSaveData,
  getProgressSummary:bbGetProgressSummary
};