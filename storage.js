/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — storage.js (v2 — bug-fixed)
   FIX: bbIsLoggedIn now checks bb_current_user directly instead
   of requiring accountExists() — this was causing Google sign-in
   and email sign-in to appear logged-out everywhere on the site.
   Account is auto-created in registry on first sign-in if missing.
═══════════════════════════════════════════════════════════════ */

const BB_KEYS = {
  ACCOUNTS:     'bb_accounts',
  CURRENT_USER: 'bb_current_user',
  SAVE_PREFIX:  'bb_save_',
  REMEMBER:     'bb_remember'
};

function bbHashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

function bbGetAccounts() {
  try {
    const raw = localStorage.getItem(BB_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function bbSaveAccounts(accounts) {
  try { localStorage.setItem(BB_KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; }
  catch (e) { return false; }
}

function bbAccountExists(username) {
  if (!username) return false;
  const accounts = bbGetAccounts();
  return Object.keys(accounts).some(u => u.toLowerCase() === username.toLowerCase());
}

function bbCreateAccount(username, password) {
  const accounts = bbGetAccounts();
  if (bbAccountExists(username)) return { success: false, error: 'Username already taken.' };
  accounts[username] = {
    passwordHash: password ? bbHashPassword(password) : 'google_oauth',
    createdAt: Date.now(),
    displayName: username
  };
  bbSaveAccounts(accounts);
  bbInitSaveData(username);
  return { success: true };
}

function bbVerifyLogin(username, password) {
  const accounts = bbGetAccounts();
  const key = Object.keys(accounts).find(u => u.toLowerCase() === username.toLowerCase());
  if (!key) return { success: false, error: 'No account found with that username.' };
  if (accounts[key].passwordHash !== bbHashPassword(password)) {
    return { success: false, error: 'Incorrect password.' };
  }
  return { success: true, username: key };
}

/* ── SESSION ── */
function bbSetCurrentUser(username, remember) {
  localStorage.setItem(BB_KEYS.CURRENT_USER, username);
  localStorage.setItem(BB_KEYS.REMEMBER, remember ? '1' : '0');
  /* Auto-register in accounts if this is a Google/OAuth user
     who hasn't been added to the accounts registry yet */
  if (!bbAccountExists(username)) {
    bbCreateAccount(username, null); // null password = OAuth user
  }
  /* Ensure save data exists */
  bbInitSaveData(username);
}

function bbGetCurrentUser() {
  return localStorage.getItem(BB_KEYS.CURRENT_USER);
}

function bbLogout() {
  localStorage.removeItem(BB_KEYS.CURRENT_USER);
}

/* ── THE KEY FIX ──
   Old: isLoggedIn = getCurrentUser() && accountExists(user)
   Bug: Google sign-in sets bb_current_user but doesn't add to accounts
        registry, so accountExists() returned false → isLoggedIn() = false
   Fix: isLoggedIn just checks if bb_current_user is set and non-empty.
        Account registry is auto-populated in bbSetCurrentUser above. */
function bbIsLoggedIn() {
  const user = bbGetCurrentUser();
  return !!(user && user.trim().length > 0);
}

/* ── SAVE DATA ── */
function bbDefaultSaveData() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    currentChapter: 1,
    chaptersCompleted: [],
    checkpointId: 'ch1_start',
    maxHp: 100,
    currentHp: 100,
    baseAttack: 10,
    speed: 3,
    bloodCoins: 0,
    abilities: {
      slot1: 'blood_surge',
      slot2: 'crimson_whirl',
      slot3: null,
      slot4: null
    },
    unlockedAbilities: ['blood_surge', 'crimson_whirl'],
    purchases: [],
    inventory: {
      smallPotions: 0,
      largePotions: 0,
      reviveCharm: false
    },
    relics: [],
    storyFlags: {
      sparedLordVael: null,
      obelisksActivated: [],
      dialogueSeen: []
    },
    settings: {
      masterVolume: 70,
      musicVolume: 60,
      sfxVolume: 80,
      pixelFilter: true,
      screenShake: true
    },
    stats: {
      deaths: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      totalPlayTime: 0,
      hpSacrificed: 0
    }
  };
}

function bbInitSaveData(username) {
  const key = BB_KEYS.SAVE_PREFIX + username;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(bbDefaultSaveData()));
  }
}

function bbGetSaveData(username) {
  username = username || bbGetCurrentUser();
  if (!username) return bbDefaultSaveData();
  try {
    const raw = localStorage.getItem(BB_KEYS.SAVE_PREFIX + username);
    if (!raw) { bbInitSaveData(username); return bbDefaultSaveData(); }
    return bbDeepMerge(bbDefaultSaveData(), JSON.parse(raw));
  } catch (e) { return bbDefaultSaveData(); }
}

function bbSaveSaveData(data, username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  try {
    data.lastPlayed = Date.now();
    localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

function bbResetSaveData(username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(bbDefaultSaveData()));
  return true;
}

function bbDeepMerge(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key]) {
      output[key] = bbDeepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

function bbGetProgressSummary(username) {
  const data = bbGetSaveData(username);
  const chapterNames = {
    1:'The Cursed Village', 2:'The Hollow Dungeon',
    3:'The Crimson Castle', 4:'The Blood Temple', 5:'The Final Realm'
  };
  return {
    chapter: data.currentChapter,
    chapterName: chapterNames[data.currentChapter] || 'Unknown',
    bloodCoins: data.bloodCoins,
    completed: data.chaptersCompleted.length,
    isComplete: data.chaptersCompleted.includes(5)
  };
}

window.BB = {
  hashPassword:       bbHashPassword,
  getAccounts:        bbGetAccounts,
  accountExists:      bbAccountExists,
  createAccount:      bbCreateAccount,
  verifyLogin:        bbVerifyLogin,
  setCurrentUser:     bbSetCurrentUser,
  getCurrentUser:     bbGetCurrentUser,
  logout:             bbLogout,
  isLoggedIn:         bbIsLoggedIn,
  getSaveData:        bbGetSaveData,
  saveSaveData:       bbSaveSaveData,
  resetSaveData:      bbResetSaveData,
  defaultSaveData:    bbDefaultSaveData,
  getProgressSummary: bbGetProgressSummary
};