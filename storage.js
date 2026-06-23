/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — storage.js
   Account management + per-user save data via localStorage
   No backend required. All data stored in browser localStorage.
═══════════════════════════════════════════════════════════════ */

const BB_KEYS = {
  ACCOUNTS:     'bb_accounts',        // { username: { passwordHash, createdAt } }
  CURRENT_USER: 'bb_current_user',    // username string
  SAVE_PREFIX:  'bb_save_',           // bb_save_<username> -> save object
  REMEMBER:     'bb_remember'         // boolean
};

/* ── SIMPLE HASH (not cryptographically secure — fine for a school project) ── */
function bbHashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

/* ── ACCOUNTS ── */
function bbGetAccounts() {
  try {
    const raw = localStorage.getItem(BB_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read accounts', e);
    return {};
  }
}

function bbSaveAccounts(accounts) {
  try {
    localStorage.setItem(BB_KEYS.ACCOUNTS, JSON.stringify(accounts));
    return true;
  } catch (e) {
    console.error('Failed to save accounts', e);
    return false;
  }
}

function bbAccountExists(username) {
  const accounts = bbGetAccounts();
  return Object.keys(accounts).some(u => u.toLowerCase() === username.toLowerCase());
}

function bbCreateAccount(username, password) {
  const accounts = bbGetAccounts();
  if (bbAccountExists(username)) {
    return { success: false, error: 'Username already taken.' };
  }
  accounts[username] = {
    passwordHash: bbHashPassword(password),
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

function bbResetPassword(username, newPassword) {
  const accounts = bbGetAccounts();
  const key = Object.keys(accounts).find(u => u.toLowerCase() === username.toLowerCase());
  if (!key) return { success: false, error: 'No account found with that username.' };
  accounts[key].passwordHash = bbHashPassword(newPassword);
  bbSaveAccounts(accounts);
  return { success: true };
}

function bbDeleteAccount(username) {
  const accounts = bbGetAccounts();
  const key = Object.keys(accounts).find(u => u.toLowerCase() === username.toLowerCase());
  if (key) {
    delete accounts[key];
    bbSaveAccounts(accounts);
    localStorage.removeItem(BB_KEYS.SAVE_PREFIX + key);
    if (bbGetCurrentUser() === key) bbLogout();
    return true;
  }
  return false;
}

/* ── SESSION ── */
function bbSetCurrentUser(username, remember) {
  localStorage.setItem(BB_KEYS.CURRENT_USER, username);
  localStorage.setItem(BB_KEYS.REMEMBER, remember ? '1' : '0');
}

function bbGetCurrentUser() {
  return localStorage.getItem(BB_KEYS.CURRENT_USER);
}

function bbLogout() {
  localStorage.removeItem(BB_KEYS.CURRENT_USER);
}

function bbIsLoggedIn() {
  const user = bbGetCurrentUser();
  return !!(user && bbAccountExists(user));
}

/* ── SAVE DATA STRUCTURE ── */
function bbDefaultSaveData() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastPlayed: Date.now(),

    // Progress
    currentChapter: 1,
    chaptersCompleted: [],
    checkpointId: 'ch1_start',

    // Player stats
    maxHp: 100,
    currentHp: 100,
    baseAttack: 10,
    speed: 3,

    // Currency
    bloodCoins: 0,

    // Abilities unlocked
    abilities: {
      slot1: 'blood_surge',
      slot2: 'crimson_whirl',
      slot3: null,
      slot4: null
    },
    unlockedAbilities: ['blood_surge', 'crimson_whirl'],

    // Shop purchases
    purchases: [],

    // Inventory
    inventory: {
      smallPotions: 0,
      largePotions: 0,
      reviveCharm: false
    },

    // Equipped relics
    relics: [],

    // Story flags
    storyFlags: {
      sparedLordVael: null,   // null | true | false
      obelisksActivated: [],  // array of obelisk ids
      dialogueSeen: []
    },

    // Settings
    settings: {
      masterVolume: 70,
      musicVolume: 60,
      sfxVolume: 80,
      pixelFilter: true,
      screenShake: true
    },

    // Stats tracking
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
    if (!raw) {
      bbInitSaveData(username);
      return bbDefaultSaveData();
    }
    const data = JSON.parse(raw);
    // Merge with defaults to handle version upgrades / missing fields
    return bbDeepMerge(bbDefaultSaveData(), data);
  } catch (e) {
    console.error('Failed to load save data', e);
    return bbDefaultSaveData();
  }
}

function bbSaveSaveData(data, username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  try {
    data.lastPlayed = Date.now();
    localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save game data', e);
    return false;
  }
}

function bbResetSaveData(username) {
  username = username || bbGetCurrentUser();
  if (!username) return false;
  localStorage.setItem(BB_KEYS.SAVE_PREFIX + username, JSON.stringify(bbDefaultSaveData()));
  return true;
}

/* ── DEEP MERGE (defaults <- saved data, preserving structure) ── */
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

/* ── PROGRESS SUMMARY (for UI display) ── */
function bbGetProgressSummary(username) {
  const data = bbGetSaveData(username);
  const chapterNames = {
    1: 'The Cursed Village',
    2: 'The Hollow Dungeon',
    3: 'The Crimson Castle',
    4: 'The Blood Temple',
    5: 'The Final Realm'
  };
  return {
    chapter: data.currentChapter,
    chapterName: chapterNames[data.currentChapter] || 'Unknown',
    bloodCoins: data.bloodCoins,
    completed: data.chaptersCompleted.length,
    isComplete: data.chaptersCompleted.includes(5)
  };
}

/* ── EXPORT FOR USE ── */
window.BB = {
  hashPassword: bbHashPassword,
  getAccounts: bbGetAccounts,
  accountExists: bbAccountExists,
  createAccount: bbCreateAccount,
  verifyLogin: bbVerifyLogin,
  resetPassword: bbResetPassword,
  deleteAccount: bbDeleteAccount,
  setCurrentUser: bbSetCurrentUser,
  getCurrentUser: bbGetCurrentUser,
  logout: bbLogout,
  isLoggedIn: bbIsLoggedIn,
  getSaveData: bbGetSaveData,
  saveSaveData: bbSaveSaveData,
  resetSaveData: bbResetSaveData,
  defaultSaveData: bbDefaultSaveData,
  getProgressSummary: bbGetProgressSummary
};