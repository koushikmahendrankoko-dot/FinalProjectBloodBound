/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — ui.js
   HUD updates: HP bar, ability slots/cooldowns, boss bar,
   currency, chapter badge, toasts, pause/death/clear screens
═══════════════════════════════════════════════════════════════ */

class UIManager {
  constructor() {
    this.hpBar = document.getElementById('hp-bar');
    this.hpVal = document.getElementById('hp-val');
    this.currencyVal = document.getElementById('currency-val');
    this.chapterNum = document.getElementById('chapter-num');
    this.chapterName = document.getElementById('chapter-name');

    this.bossHud = document.getElementById('boss-hud');
    this.bossName = document.getElementById('boss-name');
    this.bossHpBar = document.getElementById('boss-hp-bar');
    this.bossHpVal = document.getElementById('boss-hp-val');
    this.bossPhaseMarker = document.getElementById('boss-phase-marker');

    this.toastContainer = document.getElementById('toast-container');
    this.damageLayer = document.getElementById('damage-layer');

    this.chapterNames = {
      1: 'The Cursed Village',
      2: 'The Hollow Dungeon',
      3: 'The Crimson Castle',
      4: 'The Blood Temple',
      5: 'The Final Realm'
    };
  }

  updateHp(current, max) {
    const pct = Math.max(0, current / max) * 100;
    this.hpBar.style.width = pct + '%';
    this.hpVal.textContent = `${Math.max(0, Math.round(current))} / ${max}`;

    this.hpBar.classList.remove('warning', 'danger');
    if (pct <= 25) this.hpBar.classList.add('danger');
    else if (pct <= 50) this.hpBar.classList.add('warning');
  }

  updateCurrency(amount) {
    this.currencyVal.textContent = amount;
  }

  updateChapter(chapterNum) {
    const roman = ['', 'I', 'II', 'III', 'IV', 'V'][chapterNum] || chapterNum;
    this.chapterNum.textContent = roman;
    this.chapterName.textContent = this.chapterNames[chapterNum] || '';
  }

  updateAbilitySlots(player, combat) {
    const slotMap = { slot1: '1', slot2: '2', slot3: '3', slot4: '4' };

    for (const [slotKey, slotNum] of Object.entries(slotMap)) {
      const abilityKey = player.abilities[slotKey];
      const slotEl = document.getElementById(`slot-${slotNum}`);
      if (!slotEl) continue;

      if (!abilityKey) {
        slotEl.classList.add('locked');
        continue;
      }

      slotEl.classList.remove('locked');
      const ability = ABILITIES[abilityKey];
      if (!ability) continue;

      const iconEl = document.getElementById(`ability-icon-${slotNum}`);
      const nameEl = slotEl.querySelector('.slot-name');
      const costEl = slotEl.querySelector('.slot-cost');
      const cdEl = document.getElementById(`cd-${slotNum}`);

      if (iconEl) iconEl.textContent = ability.icon;
      if (nameEl) nameEl.textContent = ability.name;
      if (costEl) costEl.textContent = `${ability.hpCost} HP`;

      if (cdEl) {
        const remaining = combat.cooldowns[abilityKey] || 0;
        if (remaining > 0) {
          cdEl.classList.add('active');
          cdEl.textContent = Math.ceil(remaining / 1000);
        } else {
          cdEl.classList.remove('active');
        }
      }

      slotEl.style.opacity = player.hp <= ability.hpCost ? '0.5' : '1';
    }
  }

  flashAbilitySlot(slotNum) {
    const slotEl = document.getElementById(`slot-${slotNum}`);
    if (!slotEl) return;
    slotEl.classList.add('active-anim');
    setTimeout(() => slotEl.classList.remove('active-anim'), 200);
  }

  showBossHud(boss) {
    this.bossHud.classList.remove('hidden');
    this.bossName.textContent = boss.name;
    this.updateBossHp(boss);
  }

  hideBossHud() {
    this.bossHud.classList.add('hidden');
  }

  updateBossHp(boss) {
    const pct = Math.max(0, boss.hp / boss.maxHp) * 100;
    this.bossHpBar.style.width = pct + '%';
    this.bossHpVal.textContent = `${Math.max(0, boss.hp)} / ${boss.maxHp}`;

    const nextPhase = boss.def.phases[boss.currentPhaseIndex + 1];
    if (nextPhase) {
      this.bossPhaseMarker.style.left = (nextPhase.threshold * 100) + '%';
      this.bossPhaseMarker.style.display = 'block';
    } else {
      this.bossPhaseMarker.style.display = 'none';
    }
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  spawnDamageNumberDOM(screenX, screenY, text, type = 'normal') {
    const el = document.createElement('div');
    el.className = `dmg-num ${type}`;
    el.textContent = text;
    el.style.left = screenX + 'px';
    el.style.top = screenY + 'px';
    this.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  showPauseMenu() {
    document.getElementById('pause-menu').classList.remove('hidden');
  }
  hidePauseMenu() {
    document.getElementById('pause-menu').classList.add('hidden');
  }

  showGameOver(saveData) {
    const screen = document.getElementById('gameover-screen');
    const statsEl = document.getElementById('gameover-stats');
    screen.classList.remove('hidden');

    statsEl.innerHTML = `
      <div>Chapter Reached: ${this.chapterNames[saveData.currentChapter]}</div>
      <div>Blood Coins: ${saveData.bloodCoins}</div>
      <div>Total Deaths: ${saveData.stats.deaths}</div>
    `;
  }
  hideGameOver() {
    document.getElementById('gameover-screen').classList.add('hidden');
  }

  showChapterClear(chapterNum, rewards) {
    const screen = document.getElementById('chapter-clear');
    const titleEl = document.getElementById('clear-title');
    const subEl = document.getElementById('clear-sub');
    const rewardsEl = document.getElementById('clear-rewards');

    screen.classList.remove('hidden');
    titleEl.textContent = `Chapter ${['','I','II','III','IV','V'][chapterNum]} Complete`;
    subEl.textContent = this._chapterClearText(chapterNum);

    rewardsEl.innerHTML = (rewards || []).map(r =>
      `<span class="clear-reward-tag">${r}</span>`
    ).join('');
  }
  hideChapterClear() {
    document.getElementById('chapter-clear').classList.add('hidden');
  }

  _chapterClearText(chapterNum) {
    const texts = {
      1: 'The village burns behind you. The forest ahead hides something far worse.',
      2: 'The Hollow Beast falls silent. But the dungeon was only the beginning.',
      3: "Lord Vael's fate is sealed. The castle's secrets point toward an ancient temple.",
      4: 'The Four Guardians are no more. The path to the source of the curse lies open.',
      5: 'The curse is broken. Or perhaps... it has only just begun.'
    };
    return texts[chapterNum] || 'Onward.';
  }

  updateMinimap(mapManager, player) {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    mapManager.renderMinimap(ctx, player.cx, player.cy);
  }

  setLoadingProgress(pct, tip) {
    const bar = document.getElementById('loading-bar');
    const tipEl = document.getElementById('loading-tip');
    if (bar) bar.style.width = pct + '%';
    if (tip && tipEl) tipEl.textContent = tip;
  }

  hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    screen.classList.add('fade-out');
    setTimeout(() => screen.style.display = 'none', 600);
  }
}

window.UIManager = UIManager;