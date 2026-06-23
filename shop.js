/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — shop.js
   Shop tabs, item purchases, currency sync with save data
   Includes fix to remember user return path for auth redirects.
═══════════════════════════════════════════════════════════════ */
console.log("Shop.js loaded. Auth status:", window.BB && typeof window.BB.isLoggedIn === 'function' ? window.BB.isLoggedIn() : "BB not found");

const SHOP_ITEMS = {
  'hp-up-1':   { type: 'stat',    stat: 'maxHp',    amount: 20, cost: 50 },
  'atk-up-1':  { type: 'stat',    stat: 'baseAttack', amount: 5, cost: 60 },
  'spd-up-1':  { type: 'stat',    stat: 'speed',    amount: 1,  cost: 40 },
  'hp-up-2':   { type: 'stat',    stat: 'maxHp',    amount: 40, cost: 150, requiresChapter: 2 },
  'regen-1':   { type: 'flag',    flag: 'bloodRegen1', cost: 300, requiresChapter: 3 },
  'atk-up-2':  { type: 'stat',    stat: 'baseAttack', amount: 15, cost: 400, requiresChapter: 3 },

  'ability-hemorrhage':  { type: 'ability', ability: 'hemorrhage', slot: 3, cost: 200 },
  'ability-deathjmark':  { type: 'ability', ability: 'death_mark', slot: 4, cost: 350, requiresChapter: 3 },
  'ability-bloodtide':   { type: 'ability', ability: 'blood_tide', slot: 4, cost: 500, requiresChapter: 4 },

  'relic-vial':   { type: 'relic', relic: 'vial_of_ancients', cost: 250 },
  'relic-crown':  { type: 'relic', relic: 'crimson_crown', cost: 600, requiresChapter: 4 },

  'potion-small': { type: 'consumable', item: 'smallPotions', amount: 1, cost: 20, repeatable: true, max: 5 },
  'potion-large': { type: 'consumable', item: 'largePotions', amount: 1, cost: 75, repeatable: true, max: 3 },
  'revive-charm': { type: 'consumable', item: 'reviveCharm', cost: 100, flagItem: true }
};

let shopSaveData = null;

document.addEventListener('DOMContentLoaded', () => {
  initShopTabs();
  loadShopState();
  renderShopState();
  attachBuyButtons();
});

/* ── TAB SWITCHING ── */
function initShopTabs() {
  const tabs = document.querySelectorAll('.shop-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.shop-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    });
  });
}

/* ── LOAD SAVE STATE ── */
function loadShopState() {
  if (!window.BB) {
    shopSaveData = null;
    return;
  }
  
  if (!window.BB.isLoggedIn()) {
    // FIX: Remember we were here before redirecting to auth
    localStorage.setItem('auth_return_path', 'shop.html');
    shopSaveData = null;
    return;
  }
  shopSaveData = window.BB.getSaveData();
}

/* ── RENDER CURRENCY + CARD STATES ── */
function renderShopState() {
  const currencyEl = document.getElementById('shop-currency');

  if (!shopSaveData) {
    currencyEl.textContent = 'Sign in to shop';
    currencyEl.style.cursor = 'pointer';
    currencyEl.onclick = () => {
      localStorage.setItem('auth_return_path', 'shop.html');
      window.location.href = 'auth.html';
    };
    showShopSignInBanner();
    return;
  }

  currencyEl.textContent = shopSaveData.bloodCoins;
  currencyEl.onclick = null;
  currencyEl.style.cursor = 'default';

  const currentChapter = shopSaveData.currentChapter;
  const purchases = shopSaveData.purchases || [];

  document.querySelectorAll('.shop-card[data-id]').forEach(card => {
    const id = card.dataset.id;
    const item = SHOP_ITEMS[id];
    if (!item) return;

    const btn = card.querySelector('.shop-buy-btn');
    const alreadyOwned = purchases.includes(id);
    const chapterLocked = item.requiresChapter && currentChapter < item.requiresChapter;

    let atMax = false;
    if (item.repeatable && item.max) {
      const have = item.flagItem ? (shopSaveData.inventory[item.item] ? 1 : 0) : (shopSaveData.inventory[item.item] || 0);
      atMax = have >= item.max;
    }

    if (chapterLocked) {
      card.classList.add('locked');
      btn.disabled = true;
      btn.textContent = `🔒 Ch. ${item.requiresChapter}`;
    } else if (alreadyOwned && !item.repeatable) {
      card.classList.add('purchased');
      btn.disabled = true;
      btn.textContent = '✓ Owned';
    } else if (atMax) {
      btn.disabled = true;
      btn.textContent = 'Max Owned';
    } else {
      btn.disabled = false;
      btn.textContent = item.repeatable ? 'Buy' : (item.type === 'ability' ? 'Unlock' : 'Buy');
    }
  });
}

/* ── SIGN IN BANNER ── */
function showShopSignInBanner() {
  if (document.getElementById('shop-signin-banner')) return;
  const main = document.querySelector('.shop-main');
  const banner = document.createElement('div');
  banner.id = 'shop-signin-banner';
  banner.innerHTML = `🩸 <a href="auth.html" style="color:var(--blood-bright);">Sign in</a> to save your purchases.`;
  main.insertBefore(banner, main.firstChild);
}

/* ── PURCHASE HANDLING ── */
function attachBuyButtons() {
  document.querySelectorAll('.shop-buy-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!shopSaveData) {
        localStorage.setItem('auth_return_path', 'shop.html');
        window.location.href = 'auth.html';
        return;
      }
      if (btn.disabled) return;
      purchaseItem(btn.dataset.id, parseInt(btn.dataset.cost, 10), btn);
    });
  });
}

function purchaseItem(id, cost, btn) {
  const item = SHOP_ITEMS[id];
  const card = btn.closest('.shop-card');
  if (shopSaveData.bloodCoins < cost) return;
  shopSaveData.bloodCoins -= cost;
  window.BB.saveSaveData(shopSaveData);
  renderShopState();
}