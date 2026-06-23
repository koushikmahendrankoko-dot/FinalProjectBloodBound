/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — shop.js (v2 — auth bug fixed)
   FIX: Was redirecting to auth.html even when signed in because
   BB.isLoggedIn() was broken in storage.js (now fixed).
   Also: shop now uses BB.isLoggedIn() correctly with the fixed
   storage.js, and all '../auth.html' paths are flat 'auth.html'.
   Achievement unlock added for first shop purchase.
═══════════════════════════════════════════════════════════════ */

const SHOP_ITEMS = {
  'hp-up-1':  { type:'stat', stat:'maxHp',     amount:20, cost:50 },
  'atk-up-1': { type:'stat', stat:'baseAttack',amount:5,  cost:60 },
  'spd-up-1': { type:'stat', stat:'speed',     amount:1,  cost:40 },
  'hp-up-2':  { type:'stat', stat:'maxHp',     amount:40, cost:150, requiresChapter:2 },
  'regen-1':  { type:'flag', flag:'bloodRegen1',cost:300, requiresChapter:3 },
  'atk-up-2': { type:'stat', stat:'baseAttack',amount:15, cost:400, requiresChapter:3 },
  'ability-hemorrhage': { type:'ability', ability:'hemorrhage',  slot:3, cost:200 },
  'ability-deathjmark': { type:'ability', ability:'death_mark',  slot:4, cost:350, requiresChapter:3 },
  'ability-bloodtide':  { type:'ability', ability:'blood_tide',  slot:4, cost:500, requiresChapter:4 },
  'relic-vial':  { type:'relic', relic:'vial_of_ancients', cost:250 },
  'relic-crown': { type:'relic', relic:'crimson_crown',    cost:600, requiresChapter:4 },
  'potion-small':{ type:'consumable', item:'smallPotions', amount:1, cost:20, repeatable:true, max:5 },
  'potion-large':{ type:'consumable', item:'largePotions', amount:1, cost:75, repeatable:true, max:3 },
  'revive-charm':{ type:'consumable', item:'reviveCharm',  cost:100, flagItem:true }
};

let shopSaveData = null;

document.addEventListener('DOMContentLoaded', () => {
  initShopTabs();
  loadShopState();
  renderShopState();
  attachBuyButtons();
});

function initShopTabs() {
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.shop-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.shop-section').forEach(s=>s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-'+target)?.classList.add('active');
    });
  });
}

function loadShopState() {
  // BB.isLoggedIn() is now fixed in storage.js — just checks bb_current_user
  if (!window.BB || !window.BB.isLoggedIn()) {
    shopSaveData = null;
    return;
  }
  shopSaveData = window.BB.getSaveData();
}

function renderShopState() {
  const currencyEl = document.getElementById('shop-currency');
  if (!currencyEl) return;

  if (!shopSaveData) {
    currencyEl.textContent = 'Sign in to shop';
    currencyEl.style.cursor = 'pointer';
    currencyEl.onclick = () => window.location.href = 'auth.html';
    showShopSignInBanner();
    return;
  }

  currencyEl.textContent = shopSaveData.bloodCoins;
  currencyEl.onclick = null;
  currencyEl.style.cursor = 'default';

  const currentChapter = shopSaveData.currentChapter || 1;
  const purchases = shopSaveData.purchases || [];

  document.querySelectorAll('.shop-card[data-id]').forEach(card => {
    const id   = card.dataset.id;
    const item = SHOP_ITEMS[id];
    if (!item) return;
    const btn = card.querySelector('.shop-buy-btn');
    if (!btn) return;
    const alreadyOwned  = purchases.includes(id);
    const chapterLocked = item.requiresChapter && currentChapter < item.requiresChapter;
    let atMax = false;
    if (item.repeatable && item.max) {
      const have = item.flagItem
        ? (shopSaveData.inventory[item.item] ? 1 : 0)
        : (shopSaveData.inventory[item.item] || 0);
      atMax = have >= item.max;
    }
    if (chapterLocked) {
      card.classList.add('locked'); card.classList.remove('purchased');
      btn.disabled=true; btn.classList.add('locked-btn');
      btn.textContent=`🔒 Ch. ${item.requiresChapter}`;
    } else if (alreadyOwned && !item.repeatable) {
      card.classList.remove('locked'); card.classList.add('purchased');
      btn.disabled=true; btn.classList.remove('locked-btn'); btn.classList.add('owned-btn');
      btn.textContent='✓ Owned';
    } else if (atMax) {
      card.classList.remove('locked','purchased');
      btn.disabled=true; btn.classList.add('locked-btn'); btn.textContent='Max Owned';
    } else {
      card.classList.remove('locked','purchased');
      btn.disabled=false; btn.classList.remove('locked-btn','owned-btn');
      btn.textContent = item.repeatable?'Buy':(item.type==='ability'?'Unlock':'Buy');
    }
  });
}

function showShopSignInBanner() {
  if (document.getElementById('shop-signin-banner')) return;
  const main   = document.querySelector('.shop-main');
  if (!main) return;
  const banner = document.createElement('div');
  banner.id='shop-signin-banner';
  banner.style.cssText=`background:rgba(181,32,48,.1);border:1px solid var(--blood-muted);border-radius:var(--radius-lg);padding:16px 24px;margin-bottom:24px;text-align:center;font-size:.9rem;color:var(--text-secondary);`;
  banner.innerHTML=`🩸 <a href="auth.html" style="color:var(--blood-bright);font-weight:600;">Sign in</a> to save your purchases and track blood coins across sessions.`;
  main.insertBefore(banner, main.firstChild);
}

function attachBuyButtons() {
  document.querySelectorAll('.shop-buy-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!shopSaveData) { window.location.href='auth.html'; return; }
      if (btn.disabled) return;
      purchaseItem(btn.dataset.id, parseInt(btn.dataset.cost,10), btn);
    });
  });
}

function purchaseItem(id, cost, btn) {
  const item = SHOP_ITEMS[id];
  const card = btn.closest('.shop-card');
  if (shopSaveData.bloodCoins < cost) {
    card.classList.add('cant-afford');
    setTimeout(()=>card.classList.remove('cant-afford'), 400);
    showPageToast('Not enough Blood Coins!');
    return;
  }

  shopSaveData.bloodCoins -= cost;

  switch(item.type) {
    case 'stat':
      shopSaveData[item.stat]=(shopSaveData[item.stat]||0)+item.amount;
      if (item.stat==='maxHp') shopSaveData.currentHp=shopSaveData.maxHp;
      break;
    case 'flag':
      shopSaveData.storyFlags=shopSaveData.storyFlags||{};
      shopSaveData.storyFlags[item.flag]=true;
      break;
    case 'ability':
      if (!shopSaveData.unlockedAbilities.includes(item.ability))
        shopSaveData.unlockedAbilities.push(item.ability);
      const slotKey='slot'+item.slot;
      if (!shopSaveData.abilities[slotKey]) shopSaveData.abilities[slotKey]=item.ability;
      // Check if all 7 abilities unlocked
      if (shopSaveData.unlockedAbilities.length >= 7) {
        window.Achievements?.unlock('all_abilities');
      }
      break;
    case 'relic':
      if (!shopSaveData.relics.includes(item.relic)) shopSaveData.relics.push(item.relic);
      break;
    case 'consumable':
      if (item.flagItem) shopSaveData.inventory[item.item]=true;
      else shopSaveData.inventory[item.item]=(shopSaveData.inventory[item.item]||0)+item.amount;
      break;
  }

  if (!item.repeatable && !shopSaveData.purchases.includes(id))
    shopSaveData.purchases.push(id);

  window.BB.saveSaveData(shopSaveData);

  // Achievements
  if (window.Achievements) {
    window.Achievements.unlock('shop_first');
  }

  card.classList.add('just-purchased');
  setTimeout(()=>card.classList.remove('just-purchased'),500);
  showPageToast(`✓ Purchased! ${cost} 🩸 spent.`);
  renderShopState();
}

function showPageToast(msg, dur=3000) {
  let c=document.getElementById('global-toast-container');
  if (!c) { c=document.createElement('div'); c.id='global-toast-container'; Object.assign(c.style,{position:'fixed',bottom:'24px',right:'24px',zIndex:'9999',display:'flex',flexDirection:'column',gap:'8px'}); document.body.appendChild(c); }
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>{ t.classList.add('fade-out'); setTimeout(()=>t.remove(),300); }, dur);
}