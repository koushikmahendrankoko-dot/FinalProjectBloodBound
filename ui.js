/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — ui.js (v3 — Elden Ring edition)
   Lag HP bar, sweep cooldown arcs, boss intro slam,
   directional hurt flash, low-HP vignette pulse, parry ring HUD.
═══════════════════════════════════════════════════════════════ */

class UIManager {
  constructor() {
    this.hpBar       = document.getElementById('hp-bar');
    this.hpVal       = document.getElementById('hp-val');
    this.currencyVal = document.getElementById('currency-val');
    this.chapterNum  = document.getElementById('chapter-num');
    this.chapterName = document.getElementById('chapter-name');

    this.bossHud        = document.getElementById('boss-hud');
    this.bossName       = document.getElementById('boss-name');
    this.bossHpBar      = document.getElementById('boss-hp-bar');
    this.bossHpVal      = document.getElementById('boss-hp-val');
    this.bossPhaseMarker= document.getElementById('boss-phase-marker');

    this.toastContainer = document.getElementById('toast-container');
    this.damageLayer    = document.getElementById('damage-layer');
    this.loadingScreen  = document.getElementById('loading-screen');
    this.loadingBar     = document.getElementById('loading-bar');
    this.loadingTip     = document.getElementById('loading-tip');
    this.pauseMenu      = document.getElementById('pause-menu');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.chapterClear   = document.getElementById('chapter-clear');

    this.chapterNames = {
      1:'The Cursed Village', 2:'The Hollow Dungeon',
      3:'The Crimson Castle', 4:'The Blood Temple', 5:'The Final Realm'
    };

    this._buildOverlays();
    this._bossIntroShown = false;
  }

  /* ── OVERLAY LAYERS ── */
  _buildOverlays() {
    // Low-HP vignette
    if (!document.getElementById('vignette-overlay')) {
      const v = document.createElement('div');
      v.id = 'vignette-overlay';
      v.style.cssText = `
        position:fixed;inset:0;pointer-events:none;z-index:500;opacity:0;
        transition:opacity .25s ease;
        background:radial-gradient(ellipse at center,transparent 35%,rgba(180,10,10,.65) 100%);
      `;
      document.body.appendChild(v);
    }
    // Directional hurt flash
    if (!document.getElementById('hurt-flash-overlay')) {
      const h = document.createElement('div');
      h.id = 'hurt-flash-overlay';
      h.style.cssText = `
        position:fixed;inset:0;pointer-events:none;z-index:501;
        opacity:0;transition:opacity .1s ease;
      `;
      document.body.appendChild(h);
    }
    // Parry flash
    if (!document.getElementById('parry-flash-overlay')) {
      const p = document.createElement('div');
      p.id = 'parry-flash-overlay';
      p.style.cssText = `
        position:fixed;inset:0;pointer-events:none;z-index:502;
        opacity:0;transition:opacity .08s ease;
        background:rgba(255,204,2,.18);
      `;
      document.body.appendChild(p);
    }

    this.vignetteEl   = document.getElementById('vignette-overlay');
    this.hurtFlashEl  = document.getElementById('hurt-flash-overlay');
    this.parryFlashEl = document.getElementById('parry-flash-overlay');
  }

  /* ── HP (with lag bar) ── */
  updateHp(current, lagHp, max) {
    const pct    = Math.max(0, current/max)*100;
    const lagPct = Math.max(0, lagHp/max)*100;

    // Lag bar (yellow, behind real bar)
    const lagEl = document.getElementById('hp-lag-bar');
    if (lagEl) lagEl.style.width = lagPct+'%';

    this.hpBar.style.width = pct+'%';
    this.hpVal.textContent = `${Math.max(0,Math.round(current))} / ${max}`;

    this.hpBar.classList.remove('warning','danger');
    if (pct<=25) this.hpBar.classList.add('danger');
    else if (pct<=50) this.hpBar.classList.add('warning');

    // Low-HP vignette pulse
    if (pct<=30) {
      const intensity = (30-pct)/30;
      const pulse     = 0.4+0.3*Math.sin(Date.now()*0.005);
      this.vignetteEl.style.opacity = Math.min(0.9, intensity*(0.5+pulse*0.5));
    } else {
      this.vignetteEl.style.opacity = 0;
    }
  }

  /* ── DIRECTIONAL HURT FLASH ── */
  flashHurt(dirX=0, dirY=0) {
    if (!this.hurtFlashEl) return;
    const angleDeg = Math.atan2(dirY, dirX)*180/Math.PI;
    this.hurtFlashEl.style.background = dirX||dirY
      ? `linear-gradient(${angleDeg+90}deg, rgba(255,30,40,.55) 0%, transparent 60%)`
      : 'rgba(255,30,40,.38)';
    this.hurtFlashEl.style.opacity = 1;
    clearTimeout(this._hurtTimeout);
    this._hurtTimeout = setTimeout(()=>{ this.hurtFlashEl.style.opacity=0; }, 110);
  }

  /* ── PARRY SUCCESS FLASH ── */
  flashParry() {
    if (!this.parryFlashEl) return;
    this.parryFlashEl.style.opacity = 1;
    clearTimeout(this._parryTimeout);
    this._parryTimeout = setTimeout(()=>{ this.parryFlashEl.style.opacity=0; }, 180);
  }

  updateCurrency(amount) { this.currencyVal.textContent = amount; }

  updateChapter(chapterNum) {
    const roman = ['','I','II','III','IV','V'][chapterNum]||chapterNum;
    this.chapterNum.textContent  = roman;
    this.chapterName.textContent = this.chapterNames[chapterNum]||'';
  }

  /* ── ABILITY SLOTS with arc sweep cooldown ── */
  updateAbilitySlots(player, combat) {
    for (const [slotKey, slotNum] of Object.entries({slot1:'1',slot2:'2',slot3:'3',slot4:'4'})) {
      const abilityKey = player.abilities[slotKey];
      const slotEl     = document.getElementById('slot-'+slotNum);
      const cdEl       = document.getElementById('cd-'+slotNum);
      if (!slotEl) continue;

      if (!abilityKey) { slotEl.classList.add('locked'); continue; }
      slotEl.classList.remove('locked');

      const ability = window.ABILITIES[abilityKey];
      if (!ability) continue;

      const iconEl = document.getElementById('ability-icon-'+slotNum);
      const nameEl = slotEl.querySelector('.slot-name');
      const costEl = slotEl.querySelector('.slot-cost');
      if (iconEl) iconEl.textContent = ability.icon;
      if (nameEl) nameEl.textContent = ability.name;
      if (costEl) costEl.textContent = ability.hpCost+' HP';

      const ready    = combat.isReady(abilityKey);
      const progress = combat.getCooldownProgress(abilityKey);
      slotEl.classList.toggle('ready', ready);
      slotEl.classList.toggle('on-cooldown', !ready);

      if (cdEl) {
        if (ready) { cdEl.style.height='0%'; }
        else       { cdEl.style.height=Math.round((1-progress)*100)+'%'; }
      }

      slotEl.classList.toggle('cant-afford', !ready===false && player.hp<=ability.hpCost);
    }
  }

  flashAbilitySlot(slotNum) {
    const slotEl = document.getElementById('slot-'+slotNum);
    if (!slotEl) return;
    slotEl.classList.add('activated');
    setTimeout(()=>slotEl.classList.remove('activated'), 220);
  }

  /* ── BOSS HUD with slam intro ── */
  showBossHud(boss) {
    if (!this.bossHud) return;
    this.bossHud.classList.remove('hidden');
    // Slam boss name onto screen
    this.bossName.textContent = boss.name.toUpperCase();
    this.bossName.style.animation = 'none';
    requestAnimationFrame(()=>{ this.bossName.style.animation = ''; });
  }
  hideBossHud() { if (this.bossHud) this.bossHud.classList.add('hidden'); }

  updateBossHp(boss) {
    if (!this.bossHpBar) return;
    const pct = Math.max(0, boss.hp/boss.maxHp)*100;
    this.bossHpBar.style.width = pct+'%';
    if (this.bossHpVal) this.bossHpVal.textContent = `${Math.max(0,Math.round(boss.hp))} / ${boss.maxHp}`;
    if (this.bossPhaseMarker) {
      const nextPhase = boss.def?.phases?.[boss.currentPhaseIndex+1];
      if (nextPhase) {
        this.bossPhaseMarker.style.left = (nextPhase.threshold*100)+'%';
        this.bossPhaseMarker.style.display = 'block';
      }
      this.bossPhaseMarker.classList.toggle('flash', boss.state==='phase-transition');
    }
  }

  /* ── TOASTS ── */
  showToast(message, duration=2800) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(()=>{ toast.classList.add('fade-out'); setTimeout(()=>toast.remove(),300); }, duration);
  }

  /* ── LOADING ── */
  setLoadingProgress(pct, tip) {
    if (this.loadingBar) this.loadingBar.style.width = pct+'%';
    if (this.loadingTip && tip) this.loadingTip.textContent = tip;
  }
  hideLoadingScreen() {
    if (!this.loadingScreen) return;
    this.loadingScreen.style.opacity='0';
    setTimeout(()=>this.loadingScreen.classList.add('hidden'),400);
  }

  /* ── PAUSE / GAMEOVER / CHAPTER CLEAR ── */
  showPauseMenu() { if (this.pauseMenu) this.pauseMenu.classList.remove('hidden'); }
  hidePauseMenu() { if (this.pauseMenu) this.pauseMenu.classList.add('hidden'); }

  showGameOver(saveData) {
    if (!this.gameoverScreen) return;
    this.gameoverScreen.classList.remove('hidden');
    const statsEl = document.getElementById('gameover-stats');
    if (statsEl) statsEl.innerHTML = `
      <div class="stat-row"><span>Enemies Defeated</span><span>${saveData.stats.enemiesDefeated||0}</span></div>
      <div class="stat-row"><span>HP Sacrificed</span><span>${saveData.stats.hpSacrificed||0}</span></div>
      <div class="stat-row"><span>Deaths</span><span>${saveData.stats.deaths||0}</span></div>
    `;
  }
  hideGameOver() { if (this.gameoverScreen) this.gameoverScreen.classList.add('hidden'); }

  showChapterClear(chapterNum, rewardLabels=[]) {
    if (!this.chapterClear) return;
    this.chapterClear.classList.remove('hidden');
    const titleEl   = document.getElementById('clear-title');
    const subEl     = document.getElementById('clear-sub');
    const rewardsEl = document.getElementById('clear-rewards');
    if (titleEl) titleEl.textContent = chapterNum>=5?'Bloodbound Complete':`Chapter ${chapterNum} Complete`;
    if (subEl)   subEl.textContent   = this.chapterNames[chapterNum]||'';
    if (rewardsEl) rewardsEl.innerHTML = rewardLabels.map(r=>`<div class="reward-item">${r}</div>`).join('');
  }
  hideChapterClear() { if (this.chapterClear) this.chapterClear.classList.add('hidden'); }

  /* ── MINIMAP ── */
  updateMinimap(mapManager, player) {
    const minimapCanvas = document.getElementById('minimap-canvas');
    if (!minimapCanvas) return;
    mapManager.renderMinimap(minimapCanvas.getContext('2d'), player.cx, player.cy);
  }
}

window.UIManager = UIManager;