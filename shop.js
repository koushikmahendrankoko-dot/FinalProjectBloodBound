/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — shop.js
   Shop tabs, item purchases, currency sync with save data
═══════════════════════════════════════════════════════════════ */

// Item registry: maps data-id -> what it grants
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
    currencyEl.title = 'Click to sign in';
    currencyEl.onclick = () => window.location.href = '../auth.html';
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

    // Repeatable consumables: check max
    let atMax = false;
    if (item.repeatable && item.max) {
      const have = item.flagItem
        ? (shopSaveData.inventory[item.item] ? 1 : 0)
        : (shopSaveData.inventory[item.item] || 0);
      atMax = have >= item.max;
    }

    if (chapterLocked) {
      card.classList.add('locked');
      card.classList.remove('purchased');
      btn.disabled = true;
      btn.classList.add('locked-btn');
      btn.textContent = `🔒 Ch. ${item.requiresChapter}`;
    } else if (alreadyOwned && !item.repeatable) {
      card.classList.remove('locked');
      card.classList.add('purchased');
      btn.disabled = true;
      btn.classList.remove('locked-btn');
      btn.classList.add('owned-btn');
      btn.textContent = '✓ Owned';
    } else if (atMax) {
      card.classList.remove('locked', 'purchased');
      btn.disabled = true;
      btn.classList.add('locked-btn');
      btn.textContent = 'Max Owned';
    } else {
      card.classList.remove('locked', 'purchased');
      btn.disabled = false;
      btn.classList.remove('locked-btn', 'owned-btn');
      btn.textContent = item.repeatable ? 'Buy' : (item.type === 'ability' ? 'Unlock' : 'Buy');
    }
  });
}

/* ── SIGN IN BANNER (shown when not logged in) ── */
function showShopSignInBanner() {
  if (document.getElementById('shop-signin-banner')) return;

  const main = document.querySelector('.shop-main');
  const banner = document.createElement('div');
  banner.id = 'shop-signin-banner';
  banner.style.cssText = `
    background: rgba(181,32,48,.1);
    border: 1px solid var(--blood-muted);
    border-radius: var(--radius-lg);
    padding: 16px 24px;
    margin-bottom: 24px;
    text-align: center;
    font-size: .9rem;
    color: var(--text-secondary);
  `;
  banner.innerHTML = `
    🩸 <a href="../auth.html" style="color:var(--blood-bright); font-weight:600;">Sign in</a>
    to save your purchases and track your blood coins across sessions.
    Browsing the shop is fine without an account — but purchases won't be saved.
  `;
  main.insertBefore(banner, main.firstChild);

  // Disable all buy buttons
  document.querySelectorAll('.shop-buy-btn:not(.locked-btn)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!window.BB.isLoggedIn()) {
        e.preventDefault();
        window.location.href = '../auth.html';
      }
    });
  });
}

/* ── PURCHASE HANDLING ── */
function attachBuyButtons() {
  document.querySelectorAll('.shop-buy-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!shopSaveData) {
        window.location.href = '../auth.html';
        return;
      }
      if (btn.disabled) return;

      const id = btn.dataset.id;
      const cost = parseInt(btn.dataset.cost, 10);
      purchaseItem(id, cost, btn);
    });
  });
}

function purchaseItem(id, cost, btn) {
  const item = SHOP_ITEMS[id];
  const card = btn.closest('.shop-card');

  if (shopSaveData.bloodCoins < cost) {
    card.classList.add('cant-afford');
    setTimeout(() => card.classList.remove('cant-afford'), 400);
    showPageToast("Not enough Blood Coins. Defeat enemies and explore to earn more.");
    return;
  }

  // Deduct cost
  shopSaveData.bloodCoins -= cost;

  // Apply effect
  switch (item.type) {
    case 'stat':
      shopSaveData[item.stat] = (shopSaveData[item.stat] || 0) + item.amount;
      if (item.stat === 'maxHp') {
        shopSaveData.currentHp = shopSaveData.maxHp; // top up on max HP increase
      }
      break;

    case 'flag':
      shopSaveData.storyFlags = shopSaveData.storyFlags || {};
      shopSaveData.storyFlags[item.flag] = true;
      break;

    case 'ability':
      if (!shopSaveData.unlockedAbilities.includes(item.ability)) {
        shopSaveData.unlockedAbilities.push(item.ability);
      }
      const slotKey = 'slot' + item.slot;
      if (!shopSaveData.abilities[slotKey]) {
        shopSaveData.abilities[slotKey] = item.ability;
      }
      break;

    case 'relic':
      if (!shopSaveData.relics.includes(item.relic)) {
        shopSaveData.relics.push(item.relic);
      }
      break;

    case 'consumable':
      if (item.flagItem) {
        shopSaveData.inventory[item.item] = true;
      } else {
        shopSaveData.inventory[item.item] = (shopSaveData.inventory[item.item] || 0) + item.amount;
      }
      break;
  }

  // Record purchase (non-repeatable items)
  if (!item.repeatable && !shopSaveData.purchases.includes(id)) {
    shopSaveData.purchases.push(id);
  }

  // Persist
  window.BB.saveSaveData(shopSaveData);

  // Visual feedback
  card.classList.add('just-purchased');
  setTimeout(() => card.classList.remove('just-purchased'), 500);

  showPageToast(`✓ Purchased! ${cost} 🩸 spent.`);

  renderShopState();
}