/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — Global Bridge
   Ensures the Shop and Game can share authentication state.
═══════════════════════════════════════════════════════════════ */

window.BB = window.BB || {};

window.BB.isLoggedIn = function() {
  return localStorage.getItem('bb_current_user') !== null;
};

window.BB.getSaveData = function() {
  const data = localStorage.getItem('bb_save_data');
  return data ? JSON.parse(data) : { bloodCoins: 0, purchases: [] };
};

// ... YOUR EXISTING main.js CODE STARTS HERE ...

/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — main.js (v3 — Elden Ring edition)
   Mouse-click attack, right-click parry, Shift dodge roll,
   mouse world-position passed to player each frame.
═══════════════════════════════════════════════════════════════ */

(function () {
  let canvas, ctx;
  let camera, mapManager, combat, ui, story, progression, audio;
  let enemyManager;
  let player, boss;
  let saveData;

  let lastTime = 0;
  let running  = false;

  // Mouse world position (updated every mousemove)
  let mouseScreenX = 0, mouseScreenY = 0;

  let input = { up:false, down:false, left:false, right:false };

  const GAME_STATE = {
    MENU:'menu', PLAYING:'playing', CUTSCENE:'cutscene',
    PAUSED:'paused', GAMEOVER:'gameover', CHAPTER_CLEAR:'chapter_clear'
  };
  let state = GAME_STATE.MENU;

  window.GameSettings = { screenShake:true, pixelFilter:true, hitStop:true };

  /* ── INIT ── */
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    progression = new ProgressionManager();
    saveData    = progression.load();
    window.GameSettings.screenShake = saveData.settings.screenShake;
    window.GameSettings.pixelFilter  = saveData.settings.pixelFilter;

    audio        = new AudioManager();
    ui           = new UIManager();
    story        = new StoryManager();
    combat       = new CombatManager();
    enemyManager = new EnemyManager();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    camera = new Camera(canvas.width, canvas.height);
    window.__activeCamera = camera;
    mapManager = new MapManager();

    bindInput();
    bindMouseInput();
    bindMenuButtons();
    bindSettingsPanel();
    bindPauseMenu();

    if (window.Assets && window.Assets.loadAll) {
      window.Assets.loadAll().catch(()=>{});
    }

    simulateLoading();
  }

  function resizeCanvas() {
    const topH    = document.getElementById('hud-top')?.offsetHeight    || 0;
    const bottomH = document.getElementById('hud-bottom')?.offsetHeight || 0;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - topH - bottomH;
    if (camera) camera.resize(canvas.width, canvas.height);
  }

  /* ── LOADING ── */
  function simulateLoading() {
    const tips = [
      'Binding the blood rune...','Sharpening blades...',
      'Awakening the cursed...','Loading ancient dungeons...',
      'Preparing your sacrifice...'
    ];
    let progress = 0;
    const interval = setInterval(() => {
      progress += 8 + Math.random()*15;
      ui.setLoadingProgress(Math.min(100,progress), tips[Math.floor(Math.random()*tips.length)]);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(()=>{ ui.hideLoadingScreen(); showMainMenu(); }, 300);
      }
    }, 180);
  }

  /* ── MAIN MENU ── */
  function showMainMenu() {
    state = GAME_STATE.MENU;
    document.getElementById('main-menu').classList.remove('hidden');
    const hasProgress = saveData.currentChapter>1 || saveData.bloodCoins>0;
    document.getElementById('btn-continue').disabled = !hasProgress;
    drawMenuBackground();
  }

  function drawMenuBackground() {
    const menuCanvas = document.getElementById('menu-bg-canvas');
    if (!menuCanvas) return;
    const mctx = menuCanvas.getContext('2d');
    function resize(){ menuCanvas.width=window.innerWidth; menuCanvas.height=window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    let particles = Array.from({length:40}, ()=>({
      x:Math.random()*menuCanvas.width, y:Math.random()*menuCanvas.height,
      size:Math.random()*2+0.5, speed:Math.random()*0.4+0.1
    }));
    function render() {
      if (state !== GAME_STATE.MENU) return;
      mctx.fillStyle='#0a0000';
      mctx.fillRect(0,0,menuCanvas.width,menuCanvas.height);
      for (const p of particles) {
        p.y -= p.speed; if (p.y<0) p.y=menuCanvas.height;
        mctx.fillStyle=`rgba(255,51,71,${0.2+Math.random()*0.3})`;
        mctx.shadowColor='#ff3347'; mctx.shadowBlur=6;
        mctx.beginPath(); mctx.arc(p.x,p.y,p.size,0,Math.PI*2); mctx.fill();
      }
      requestAnimationFrame(render);
    }
    render();
  }

  function bindMenuButtons() {
    document.getElementById('btn-new-game').addEventListener('click', ()=>{
      audio.init(); audio.playSfx('menu_click');
      if (saveData.currentChapter>1||saveData.bloodCoins>0) {
        if (!confirm('Starting a new game will reset your progress. Continue?')) return;
        saveData = progression.resetProgress();
      }
      startGame();
    });
    document.getElementById('btn-continue').addEventListener('click', ()=>{ audio.init(); audio.playSfx('menu_click'); startGame(); });
    document.getElementById('btn-settings').addEventListener('click', ()=>{ audio.init(); document.getElementById('settings-overlay').classList.remove('hidden'); });
  }

  function bindSettingsPanel() {
    document.getElementById('close-settings').addEventListener('click', ()=>{ document.getElementById('settings-overlay').classList.add('hidden'); });
    const volM=document.getElementById('vol-master');
    const volMu=document.getElementById('vol-music');
    const volS=document.getElementById('vol-sfx');
    volM.addEventListener('input', ()=>{ document.getElementById('vol-master-val').textContent=volM.value; audio.setMasterVolume(volM.value/100); saveData.settings.masterVolume=+volM.value; });
    volMu.addEventListener('input',()=>{ document.getElementById('vol-music-val').textContent=volMu.value; audio.setMusicVolume(volMu.value/100); saveData.settings.musicVolume=+volMu.value; });
    volS.addEventListener('input', ()=>{ document.getElementById('vol-sfx-val').textContent=volS.value; audio.setSfxVolume(volS.value/100); saveData.settings.sfxVolume=+volS.value; });
    document.getElementById('toggle-pixel').addEventListener('click',(e)=>{ window.GameSettings.pixelFilter=!window.GameSettings.pixelFilter; e.target.classList.toggle('active',window.GameSettings.pixelFilter); e.target.textContent=window.GameSettings.pixelFilter?'ON':'OFF'; saveData.settings.pixelFilter=window.GameSettings.pixelFilter; });
    document.getElementById('toggle-shake').addEventListener('click',(e)=>{ window.GameSettings.screenShake=!window.GameSettings.screenShake; e.target.classList.toggle('active',window.GameSettings.screenShake); e.target.textContent=window.GameSettings.screenShake?'ON':'OFF'; saveData.settings.screenShake=window.GameSettings.screenShake; });
    const resetBtn=document.createElement('button');
    resetBtn.className='reset-progress-btn'; resetBtn.textContent='⚠ Reset All Progress';
    resetBtn.addEventListener('click',()=>{ if(confirm('This will permanently erase your save data. Are you sure?')){ saveData=progression.resetProgress(); ui.showToast('Progress has been reset.'); document.getElementById('settings-overlay').classList.add('hidden'); location.reload(); } });
    document.querySelector('#settings-overlay .overlay-panel').appendChild(resetBtn);
  }

  function bindPauseMenu() {
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-save').addEventListener('click', ()=>{ progression.syncFromPlayer(player); progression.save(); ui.showToast('✓ Game saved.'); });
    document.getElementById('btn-settings-pause').addEventListener('click', ()=>{ document.getElementById('settings-overlay').classList.remove('hidden'); });
    document.getElementById('btn-quit').addEventListener('click', ()=>{ if(confirm('Quit to main menu? Unsaved progress will be lost.')) location.reload(); });
    document.getElementById('btn-retry').addEventListener('click', ()=>{ ui.hideGameOver(); respawnPlayer(); });
    document.getElementById('btn-gameover-menu').addEventListener('click', ()=>location.reload());
    document.getElementById('btn-next-chapter').addEventListener('click', ()=>{ ui.hideChapterClear(); loadChapter(saveData.currentChapter); });
  }

  function togglePause() {
    if (state===GAME_STATE.PLAYING)      { state=GAME_STATE.PAUSED;  ui.showPauseMenu(); }
    else if (state===GAME_STATE.PAUSED)  { state=GAME_STATE.PLAYING; ui.hidePauseMenu(); }
  }

  /* ── START GAME ── */
  function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    player = new Player(saveData);
    loadChapter(saveData.currentChapter, true);
  }

  function loadChapter(chapterNum, isInitialLoad) {
    const mapData = mapManager.load(chapterNum);
    enemyManager.spawnFromMapData(mapData);
    combat.reset();
    boss = null;

    camera.setWorldSize(mapManager.worldWidth, mapManager.worldHeight);
    progression.applyToPlayer(player);
    player.setPosition(mapData.playerStart.x, mapData.playerStart.y);
    if (!isInitialLoad) player.hp = player.maxHp;

    camera.snapTo(player.cx, player.cy);
    ui.updateChapter(chapterNum);
    ui.hideBossHud();
    audio.playMusic(mapData.music);

    const introKey = `ch${chapterNum}_intro`;
    if (!progression.hasSeenDialogue(introKey)) {
      state = GAME_STATE.CUTSCENE;
      story.play(introKey, ()=>{ progression.markDialogueSeen(introKey); state=GAME_STATE.PLAYING; });
    } else {
      state = GAME_STATE.PLAYING;
    }

    document.getElementById('main-menu').classList.add('hidden');
    if (!running) { running=true; requestAnimationFrame(loop); }
  }

  function respawnPlayer() {
    const mapData = mapManager.data;
    player.setPosition(mapData.playerStart.x, mapData.playerStart.y);
    player.hp = progression.getRespawnHp();
    player.lagHp = player.hp;
    player.dead = false; player.deathTimer = 0; player.hasRevived = false;
    camera.snapTo(player.cx, player.cy);
    state = GAME_STATE.PLAYING;
  }

  /* ── KEYBOARD INPUT ── */
  function bindInput() {
    window.addEventListener('keydown', (e)=>{
      handleKey(e.key.toLowerCase(), true);
      if (state===GAME_STATE.CUTSCENE && (e.key==='e'||e.key===' ')) { story.advance(); e.preventDefault(); }
      if (e.key==='Escape' && (state===GAME_STATE.PLAYING||state===GAME_STATE.PAUSED)) togglePause();
      if (state===GAME_STATE.PLAYING && ['1','2','3','4'].includes(e.key)) useAbilitySlot(parseInt(e.key,10));
      if (state===GAME_STATE.PLAYING && e.key.toLowerCase()==='q') {
        if (player.usePotion()) { audio.playSfx('potion'); ui.showToast('Used a potion.'); }
      }
      if (state===GAME_STATE.PLAYING && (e.key==='Shift'||e.key==='shift')) {
        if (player.triggerRoll()) audio.playSfx('menu_click');
      }
      if (e.key===' ') e.preventDefault();
    });
    window.addEventListener('keyup', (e)=>handleKey(e.key.toLowerCase(), false));
  }

  function handleKey(key, isDown) {
    switch(key) {
      case 'w': case 'arrowup':    input.up    = isDown; break;
      case 's': case 'arrowdown':  input.down  = isDown; break;
      case 'a': case 'arrowleft':  input.left  = isDown; break;
      case 'd': case 'arrowright': input.right = isDown; break;
    }
  }

  /* ── MOUSE INPUT ── */
  function bindMouseInput() {
    // Track mouse position over canvas
    canvas.addEventListener('mousemove', (e)=>{
      const rect = canvas.getBoundingClientRect();
      mouseScreenX = e.clientX - rect.left;
      mouseScreenY = e.clientY - rect.top;
    });

    // Left click — basic attack
    canvas.addEventListener('mousedown', (e)=>{
      if (e.button !== 0) return;
      if (state !== GAME_STATE.PLAYING) return;
      if (player.triggerAttack()) audio.playSfx('attack');
    });

    // Right click — parry
    canvas.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      if (state !== GAME_STATE.PLAYING) return;
      player.triggerParry();
    });

    // Touch support — tap to attack
    canvas.addEventListener('touchstart', (e)=>{
      e.preventDefault();
      if (state !== GAME_STATE.PLAYING) return;
      const touch = e.touches[0];
      const rect  = canvas.getBoundingClientRect();
      mouseScreenX = touch.clientX - rect.left;
      mouseScreenY = touch.clientY - rect.top;
      if (player.triggerAttack()) audio.playSfx('attack');
    }, { passive: false });

    canvas.addEventListener('touchmove', (e)=>{
      e.preventDefault();
      const touch = e.touches[0];
      const rect  = canvas.getBoundingClientRect();
      mouseScreenX = touch.clientX - rect.left;
      mouseScreenY = touch.clientY - rect.top;
    }, { passive: false });
  }

  function useAbilitySlot(slotNum) {
    const abilityKey = player.abilities['slot'+slotNum];
    if (!abilityKey) return;
    const targets = boss ? [...enemyManager.enemies, boss] : enemyManager.enemies;
    const used = combat.useAbility(abilityKey, player, targets, camera, saveData);
    if (used) { audio.playSfx('blood_ability'); ui.flashAbilitySlot(slotNum); }
  }

  function tryInteract() {
    const mapData = mapManager.data;
    const tx = Math.floor(player.cx/Sprites.TILE_SIZE);
    const ty = Math.floor(player.cy/Sprites.TILE_SIZE);
    for (const [ctx_,cty] of [[tx,ty],[tx+1,ty],[tx-1,ty],[tx,ty+1],[tx,ty-1]]) {
      const tile = mapData.grid[cty]?.[ctx_];
      if (tile===TileTypes.CHEST) {
        const loot = mapManager.openChest(ctx_,cty);
        if (loot) {
          if (loot.bloodCoins) player.bloodCoins += loot.bloodCoins;
          if (loot.potions) player.smallPotions += loot.potions;
          audio.playSfx('chest_open');
          Particles.chestOpen(ctx_*Sprites.TILE_SIZE+16, cty*Sprites.TILE_SIZE+16);
          ui.showToast(`Chest opened! +${loot.bloodCoins||0} coins${loot.potions?' +'+loot.potions+' potion':''}`);
        }
        return;
      }
      if (tile===TileTypes.DOOR) { mapManager.openDoor(ctx_,cty); audio.playSfx('door_open'); ui.showToast('Door opened.'); return; }
    }
  }

  /* ── GAME LOOP ── */
  function loop(timestamp) {
    let dt = Math.min(50, timestamp - lastTime || 16.67);
    lastTime = timestamp;

    // Hit-stop consumes dt before any gameplay update
    if (camera) dt = camera.consumeHitStop(dt);

    if (state === GAME_STATE.PLAYING) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    // Pass input + mouse world position to player
    player.input  = input;
    const worldMouse = camera.screenToWorld(mouseScreenX, mouseScreenY);
    player.mouseX = worldMouse.x;
    player.mouseY = worldMouse.y;

    player.update(dt, mapManager, combat, saveData);

    // Resolve attack on active frame
    if (player.consumeAttackResolve()) {
      const targets = boss ? [...enemyManager.enemies, boss] : enemyManager.enemies;
      combat.basicAttack(player, targets, camera);
    }

    // Directional hurt flash
    if (player.hurtTimer > 0 && player.hurtTimer >= player.HURT_DURATION - dt) {
      ui.flashHurt(player.lastHurtDirX, player.lastHurtDirY);
    }

    if (player.dead && state===GAME_STATE.PLAYING) { onPlayerDeath(); return; }

    mapManager.update(dt);

    const bloodFromKills = enemyManager.update(dt, mapManager, player, combat);
    if (bloodFromKills > 0) {
      player.bloodCoins += bloodFromKills;
      saveData.stats.enemiesDefeated = (saveData.stats.enemiesDefeated||0)+1;
    }

    const mapData = mapManager.data;
    if (mapData.boss && !boss && enemyManager.aliveCount===0) spawnBoss(mapData.boss);
    if (boss) {
      boss.update(dt, player, mapManager, combat, camera);
      ui.updateBossHp(boss);
      if (boss.dead && boss.deathTimer>700 && state===GAME_STATE.PLAYING) onBossDefeated();
    }

    combat.update(dt, mapManager, player, [...enemyManager.enemies, ...(boss?[boss]:[])]);

    camera.follow(player.cx, player.cy,
      input.left?-1:input.right?1:0,
      input.up  ?-1:input.down ?1:0
    );
    camera.update(dt);

    ui.updateHp(player.hp, player.lagHp, player.maxHp);
    ui.updateCurrency(player.bloodCoins);
    ui.updateAbilitySlots(player, combat);
    ui.updateMinimap(mapManager, player);
  }

  function spawnBoss(bossData) {
    boss = new Boss(bossData.type, bossData.tx, bossData.ty);
    ui.showBossHud(boss);
    audio.playMusic('boss');
    const introKey = `ch${saveData.currentChapter}_boss_intro`;
    if (!progression.hasSeenDialogue(introKey)) {
      state = GAME_STATE.CUTSCENE;
      story.play(introKey, ()=>{ progression.markDialogueSeen(introKey); state=GAME_STATE.PLAYING; });
    }
  }

  function onPlayerDeath() {
    state = GAME_STATE.GAMEOVER;
    progression.recordDeath();
    progression.syncFromPlayer(player);
    audio.playMusic('gameover');
    ui.showGameOver(saveData);
  }

  function onBossDefeated() {
    const chapterNum = saveData.currentChapter;
    if (boss.type==='lord_vael') {
      const spare = confirm("Lord Vael is defeated. Spare him?");
      progression.setFlag('sparedLordVael', spare);
      const outroKey = spare?'ch3_outro_spare':'ch3_outro_kill';
      state = GAME_STATE.CUTSCENE;
      story.play('ch3_boss_reveal', ()=>{ story.play(outroKey, ()=>finishChapter(chapterNum)); });
      return;
    }
    const outroKey = `ch${chapterNum}_outro`;
    state = GAME_STATE.CUTSCENE;
    story.play(outroKey, ()=>finishChapter(chapterNum));
  }

  function finishChapter(chapterNum) {
    progression.syncFromPlayer(player);
    const rewards = progression.completeChapter(chapterNum);
    saveData = progression.saveData;
    if (chapterNum>=5) {
      const ending    = progression.getEnding();
      const endingKey = (ending==='true_break'||ending==='partial')?'ch5_ending_break':'ch5_ending_absorb';
      story.play(endingKey, ()=>{ ui.showChapterClear(5,['Game Complete!','Ending: '+ending.replace('_',' ').toUpperCase()]); state=GAME_STATE.CHAPTER_CLEAR; });
    } else {
      ui.showChapterClear(chapterNum, rewards.labels);
      state = GAME_STATE.CHAPTER_CLEAR;
    }
  }

  /* ── RENDER ── */
  function render() {
    ctx.fillStyle = '#0a0000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if (state===GAME_STATE.MENU) return;

    if (mapManager.data) mapManager.renderBackground(ctx, camera, canvas.width, canvas.height);

    camera.apply(ctx);
    mapManager.render(ctx, camera);

    // Blood decals below everything
    combat.renderDecals(ctx);

    const renderables = [...enemyManager.enemies, player];
    if (boss) renderables.push(boss);
    renderables.sort((a,b)=>(a.y+(a.height||0))-(b.y+(b.height||0)));

    for (const r of renderables) {
      if (r===player)     { player.renderHpBar(ctx); player.render(ctx, camera); }
      else if (r===boss)  { boss.render(ctx, camera); }
      else                { r.render(ctx, camera); r.renderHpBar && r.renderHpBar(ctx); }
    }

    if (boss) boss.renderBossBar(ctx, canvas.width);

    combat.renderProjectiles(ctx);
    Particles.update(16.67, mapManager);
    Particles.render(ctx, camera);

    camera.restore(ctx);

    // Screen-space — draw crosshair at mouse position
    if (state===GAME_STATE.PLAYING) renderCrosshair(ctx);

    combat.renderDamageNumbers(ctx, camera);
  }

  /* Subtle blood-red crosshair replacing the default cursor */
  function renderCrosshair(ctx) {
    const x = mouseScreenX, y = mouseScreenY;
    const r = 8;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#ff3347';
    ctx.shadowColor = '#ff3347';
    ctx.shadowBlur  = 6;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(x-r,y); ctx.lineTo(x+r,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.strokeStyle='rgba(255,51,71,.4)'; ctx.stroke();
    ctx.restore();
  }

  document.addEventListener('DOMContentLoaded', init);
})();