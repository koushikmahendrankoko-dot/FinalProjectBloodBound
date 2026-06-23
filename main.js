/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — main.js
   Game loop, input handling, scene/state management.
   Ties together: sprites, camera, map, particles, combat,
   player, enemy, boss, ui, story, progression, audio.
═══════════════════════════════════════════════════════════════ */

(function () {
  let canvas, ctx;
  let camera, mapManager, combat, ui, story, progression, audio;
  let enemyManager;
  let player, boss;
  let saveData;

  let lastTime = 0;
  let running = false;

  let input = { up: false, down: false, left: false, right: false, attack: false, interact: false, potion: false };

  const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    CUTSCENE: 'cutscene',
    PAUSED: 'paused',
    GAMEOVER: 'gameover',
    CHAPTER_CLEAR: 'chapter_clear'
  };
  let state = GAME_STATE.MENU;

  window.GameSettings = { screenShake: true, pixelFilter: true };

  /* ══════════════════════════════════════════════════════════
     INITIALIZATION
  ══════════════════════════════════════════════════════════ */
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    progression = new ProgressionManager();
    saveData = progression.load();
    window.GameSettings.screenShake = saveData.settings.screenShake;
    window.GameSettings.pixelFilter = saveData.settings.pixelFilter;

    audio = new AudioManager();
    ui = new UIManager();
    story = new StoryManager();
    combat = new CombatManager();
    enemyManager = new EnemyManager();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    camera = new Camera(canvas.width, canvas.height);
    mapManager = new MapManager();

    bindInput();
    bindMenuButtons();
    bindSettingsPanel();
    bindPauseMenu();

    simulateLoading();
  }

  function resizeCanvas() {
    const topHud = document.getElementById('hud-top');
    const bottomHud = document.getElementById('hud-bottom');
    const topH = topHud ? topHud.offsetHeight : 0;
    const bottomH = bottomHud ? bottomHud.offsetHeight : 0;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - topH - bottomH;

    if (camera) camera.resize(canvas.width, canvas.height);
  }

  /* ══════════════════════════════════════════════════════════
     LOADING SCREEN SIMULATION
  ══════════════════════════════════════════════════════════ */
  function simulateLoading() {
    const tips = [
      'Binding the blood rune...',
      'Sharpening blades...',
      'Awakening the cursed...',
      'Loading ancient dungeons...',
      'Preparing your sacrifice...'
    ];

    ui.setLoadingProgress(2, tips[0]);

    window.Assets.loadAll((progress, key, success) => {
      const pct = Math.round(progress * 100);
      const tip = tips[Math.floor(progress * (tips.length - 1))];
      ui.setLoadingProgress(pct, tip);
    }).then((summary) => {
      console.log(`Assets loaded: ${summary.imagesLoaded} images, ${summary.audioLoaded} audio files. Using procedural fallback for everything else.`);
      ui.setLoadingProgress(100, 'Ready.');
      setTimeout(() => {
        ui.hideLoadingScreen();
        showMainMenu();
      }, 300);
    });
  }

  /* ══════════════════════════════════════════════════════════
     MAIN MENU
  ══════════════════════════════════════════════════════════ */
  function showMainMenu() {
    state = GAME_STATE.MENU;
    document.getElementById('main-menu').classList.remove('hidden');

    const hasProgress = saveData.currentChapter > 1 || saveData.bloodCoins > 0;
    const continueBtn = document.getElementById('btn-continue');
    continueBtn.disabled = !hasProgress;

    drawMenuBackground();
  }

  function drawMenuBackground() {
    const menuCanvas = document.getElementById('menu-bg-canvas');
    if (!menuCanvas) return;
    const mctx = menuCanvas.getContext('2d');

    function resize() {
      menuCanvas.width = window.innerWidth;
      menuCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * menuCanvas.width,
      y: Math.random() * menuCanvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.4 + 0.1
    }));

    function render() {
      if (state !== GAME_STATE.MENU) return;
      mctx.fillStyle = '#0a0000';
      mctx.fillRect(0, 0, menuCanvas.width, menuCanvas.height);

      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < 0) p.y = menuCanvas.height;
        mctx.fillStyle = `rgba(255,51,71,${0.2 + Math.random() * 0.3})`;
        mctx.shadowColor = '#ff3347';
        mctx.shadowBlur = 6;
        mctx.beginPath();
        mctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        mctx.fill();
      }
      requestAnimationFrame(render);
    }
    render();
  }

  function bindMenuButtons() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      audio.init();
      audio.playSfx('menu_click');
      if (saveData.currentChapter > 1 || saveData.bloodCoins > 0) {
        if (!confirm('Starting a new game will reset your progress. Continue?')) return;
        saveData = progression.resetProgress();
      }
      startGame();
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
      audio.init();
      audio.playSfx('menu_click');
      startGame();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      audio.init();
      document.getElementById('settings-overlay').classList.remove('hidden');
    });
  }

  function bindSettingsPanel() {
    const closeBtn = document.getElementById('close-settings');
    closeBtn.addEventListener('click', () => {
      document.getElementById('settings-overlay').classList.add('hidden');
    });

    const volMaster = document.getElementById('vol-master');
    const volMusic = document.getElementById('vol-music');
    const volSfx = document.getElementById('vol-sfx');

    volMaster.addEventListener('input', () => {
      document.getElementById('vol-master-val').textContent = volMaster.value;
      audio.setMasterVolume(volMaster.value / 100);
      saveData.settings.masterVolume = parseInt(volMaster.value, 10);
    });
    volMusic.addEventListener('input', () => {
      document.getElementById('vol-music-val').textContent = volMusic.value;
      audio.setMusicVolume(volMusic.value / 100);
      saveData.settings.musicVolume = parseInt(volMusic.value, 10);
    });
    volSfx.addEventListener('input', () => {
      document.getElementById('vol-sfx-val').textContent = volSfx.value;
      audio.setSfxVolume(volSfx.value / 100);
      saveData.settings.sfxVolume = parseInt(volSfx.value, 10);
    });

    document.getElementById('toggle-pixel').addEventListener('click', (e) => {
      window.GameSettings.pixelFilter = !window.GameSettings.pixelFilter;
      e.target.classList.toggle('active', window.GameSettings.pixelFilter);
      e.target.textContent = window.GameSettings.pixelFilter ? 'ON' : 'OFF';
      saveData.settings.pixelFilter = window.GameSettings.pixelFilter;
    });
    document.getElementById('toggle-shake').addEventListener('click', (e) => {
      window.GameSettings.screenShake = !window.GameSettings.screenShake;
      e.target.classList.toggle('active', window.GameSettings.screenShake);
      e.target.textContent = window.GameSettings.screenShake ? 'ON' : 'OFF';
      saveData.settings.screenShake = window.GameSettings.screenShake;
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-progress-btn';
    resetBtn.textContent = '⚠ Reset All Progress';
    resetBtn.addEventListener('click', () => {
      if (confirm('This will permanently erase your save data. Are you sure?')) {
        saveData = progression.resetProgress();
        ui.showToast('Progress has been reset.');
        document.getElementById('settings-overlay').classList.add('hidden');
        location.reload();
      }
    });
    document.querySelector('#settings-overlay .overlay-panel').appendChild(resetBtn);
  }

  function bindPauseMenu() {
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-save').addEventListener('click', () => {
      progression.syncFromPlayer(player);
      progression.save();
      ui.showToast('✓ Game saved.');
    });
    document.getElementById('btn-settings-pause').addEventListener('click', () => {
      document.getElementById('settings-overlay').classList.remove('hidden');
    });
    document.getElementById('btn-quit').addEventListener('click', () => {
      if (confirm('Quit to main menu? Unsaved progress will be lost.')) {
        location.reload();
      }
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      ui.hideGameOver();
      respawnPlayer();
    });
    document.getElementById('btn-gameover-menu').addEventListener('click', () => location.reload());

    document.getElementById('btn-next-chapter').addEventListener('click', () => {
      ui.hideChapterClear();
      loadChapter(saveData.currentChapter);
    });
  }

  function togglePause() {
    if (state === GAME_STATE.PLAYING) {
      state = GAME_STATE.PAUSED;
      ui.showPauseMenu();
    } else if (state === GAME_STATE.PAUSED) {
      state = GAME_STATE.PLAYING;
      ui.hidePauseMenu();
    }
  }

  /* ══════════════════════════════════════════════════════════
     START GAME / LOAD CHAPTER
  ══════════════════════════════════════════════════════════ */
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
    if (!isInitialLoad) {
      player.hp = player.maxHp;
    }

    camera.snapTo(player.cx, player.cy);
    ui.updateChapter(chapterNum);
    ui.hideBossHud();

    audio.playMusic(mapData.music);

    const introKey = `ch${chapterNum}_intro`;
    if (!progression.hasSeenDialogue(introKey)) {
      state = GAME_STATE.CUTSCENE;
      story.play(introKey, () => {
        progression.markDialogueSeen(introKey);
        state = GAME_STATE.PLAYING;
      });
    } else {
      state = GAME_STATE.PLAYING;
    }

    document.getElementById('main-menu').classList.add('hidden');
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  }

  function respawnPlayer() {
    const mapData = mapManager.data;
    player.setPosition(mapData.playerStart.x, mapData.playerStart.y);
    player.hp = progression.getRespawnHp();
    player.dead = false;
    player.deathTimer = 0;
    player.hasRevived = false;
    camera.snapTo(player.cx, player.cy);
    state = GAME_STATE.PLAYING;
  }

  /* ══════════════════════════════════════════════════════════
     INPUT HANDLING
  ══════════════════════════════════════════════════════════ */
  function bindInput() {
    window.addEventListener('keydown', (e) => {
      handleKey(e.key.toLowerCase(), true);

      if (state === GAME_STATE.CUTSCENE && (e.key === 'e' || e.key === ' ')) {
        story.advance();
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        if (state === GAME_STATE.PLAYING || state === GAME_STATE.PAUSED) togglePause();
      }

      if (state === GAME_STATE.PLAYING && ['1','2','3','4'].includes(e.key)) {
        useAbilitySlot(parseInt(e.key, 10));
      }

      if (state === GAME_STATE.PLAYING && e.key.toLowerCase() === 'q') {
        if (player.usePotion()) {
          audio.playSfx('potion');
          ui.showToast('Used a potion.');
        }
      }

      if (e.key === ' ') e.preventDefault();
    });

    window.addEventListener('keyup', (e) => handleKey(e.key.toLowerCase(), false));
  }

  function handleKey(key, isDown) {
    switch (key) {
      case 'w': case 'arrowup':    input.up = isDown; break;
      case 's': case 'arrowdown':  input.down = isDown; break;
      case 'a': case 'arrowleft':  input.left = isDown; break;
      case 'd': case 'arrowright': input.right = isDown; break;
      case ' ':
        if (isDown && state === GAME_STATE.PLAYING) triggerBasicAttack();
        break;
      case 'e':
        if (isDown && state === GAME_STATE.PLAYING) tryInteract();
        break;
    }
  }

  function triggerBasicAttack() {
    if (!player.triggerAttack()) return;
    audio.playSfx('attack');
    const targets = boss ? [...enemyManager.enemies, boss] : enemyManager.enemies;
    combat.basicAttack(player, targets, camera);
  }

  function useAbilitySlot(slotNum) {
    const abilityKey = player.abilities['slot' + slotNum];
    if (!abilityKey) return;

    const targets = boss ? [...enemyManager.enemies, boss] : enemyManager.enemies;
    const used = combat.useAbility(abilityKey, player, targets, camera, saveData);
    if (used) {
      audio.playSfx('blood_ability');
      ui.flashAbilitySlot(slotNum);
    }
  }

  function tryInteract() {
    const mapData = mapManager.data;
    const tx = Math.floor(player.cx / Sprites.TILE_SIZE);
    const ty = Math.floor(player.cy / Sprites.TILE_SIZE);

    const checks = [[tx,ty],[tx+1,ty],[tx-1,ty],[tx,ty+1],[tx,ty-1]];
    for (const [ctx_, cty] of checks) {
      const tile = mapData.grid[cty]?.[ctx_];
      if (tile === TileTypes.CHEST) {
        const loot = mapManager.openChest(ctx_, cty);
        if (loot) {
          if (loot.bloodCoins) player.bloodCoins += loot.bloodCoins;
          if (loot.potions) player.smallPotions += loot.potions;
          audio.playSfx('chest_open');
          Particles.chestOpen(ctx_ * Sprites.TILE_SIZE + 16, cty * Sprites.TILE_SIZE + 16);
          ui.showToast(`Chest opened! +${loot.bloodCoins || 0} blood coins${loot.potions ? ' +' + loot.potions + ' potion' : ''}`);

          const chestData = mapData.chests?.find(c => c.tx === ctx_ && c.ty === cty);
          if (chestData?.obelisk) {
            const count = progression.activateObelisk(chestData.obelisk);
            story.play('ch4_obelisk', () => {});
            ui.showToast(`Obelisk activated! (${count}/4)`);
          }
        }
        return;
      }
      if (tile === TileTypes.DOOR) {
        mapManager.openDoor(ctx_, cty);
        audio.playSfx('door_open');
        ui.showToast('Door opened.');
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     GAME LOOP
  ══════════════════════════════════════════════════════════ */
  function loop(timestamp) {
    const dt = Math.min(50, timestamp - lastTime || 16.67);
    lastTime = timestamp;

    if (state === GAME_STATE.PLAYING) {
      update(dt);
    }
    render();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    player.input = input;
    player.update(dt, mapManager, combat, saveData);

    if (player.dead && state === GAME_STATE.PLAYING) {
      onPlayerDeath();
      return;
    }

    mapManager.update(dt);

    const bloodFromKills = enemyManager.update(dt, mapManager, player, combat);
    if (bloodFromKills > 0) {
      player.bloodCoins += bloodFromKills;
      saveData.stats.enemiesDefeated = (saveData.stats.enemiesDefeated || 0) + 1;
    }

    const mapData = mapManager.data;
    if (mapData.boss && !boss && enemyManager.aliveCount === 0) {
      spawnBoss(mapData.boss);
    }
    if (boss) {
      boss.update(dt, mapManager, player, combat, enemyManager);
      ui.updateBossHp(boss);

      if (boss.defeated && boss.defeatTimer > 700 && state === GAME_STATE.PLAYING) {
        onBossDefeated();
      }
    }

    combat.update(dt, mapManager, player, [...enemyManager.enemies, ...(boss ? [boss] : [])]);

    camera.follow(player.cx, player.cy);
    camera.update(dt);

    ui.updateHp(player.hp, player.maxHp);
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
      story.play(introKey, () => {
        progression.markDialogueSeen(introKey);
        state = GAME_STATE.PLAYING;
      });
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

    if (boss.type === 'lord_vael') {
      const spare = confirm("Lord Vael is defeated and at your mercy. Spare him? (OK = Spare, Cancel = Finish him)");
      progression.setFlag('sparedLordVael', spare);
      const outroKey = spare ? 'ch3_outro_spare' : 'ch3_outro_kill';
      state = GAME_STATE.CUTSCENE;
      story.play('ch3_boss_reveal', () => {
        story.play(outroKey, () => finishChapter(chapterNum));
      });
      return;
    }

    const outroKey = `ch${chapterNum}_outro`;
    state = GAME_STATE.CUTSCENE;
    story.play(outroKey, () => finishChapter(chapterNum));
  }

  function finishChapter(chapterNum) {
    progression.syncFromPlayer(player);
    const rewards = progression.completeChapter(chapterNum);
    saveData = progression.saveData;

    if (chapterNum >= 5) {
      const ending = progression.getEnding();
      const endingKey = (ending === 'true_break' || ending === 'partial') ? 'ch5_ending_break' : 'ch5_ending_absorb';
      story.play(endingKey, () => {
        ui.showChapterClear(5, ['Game Complete!', 'Ending: ' + ending.replace('_',' ').toUpperCase()]);
        state = GAME_STATE.CHAPTER_CLEAR;
      });
    } else {
      ui.showChapterClear(chapterNum, rewards.labels);
      state = GAME_STATE.CHAPTER_CLEAR;
    }
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  function render() {
    ctx.fillStyle = '#0a0000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state === GAME_STATE.MENU) return;

    mapManager.renderBackground(ctx, camera);

    camera.apply(ctx);

    mapManager.render(ctx, camera);

    const renderables = [...enemyManager.enemies, player];
    if (boss) renderables.push(boss);
    renderables.sort((a, b) => (a.y + (a.height||0)) - (b.y + (b.height||0)));

    for (const r of renderables) {
      if (r === player) {
        player.renderHpBar(ctx);
        player.render(ctx, camera);
      } else if (r === boss) {
        boss.render(ctx, camera);
      } else {
        r.render(ctx, camera);
        r.renderHpBar(ctx);
      }
    }

    combat.renderProjectiles(ctx);
    Particles.update(16.67, mapManager);
    Particles.render(ctx);

    camera.restore(ctx);

    combat.renderDamageNumbers(ctx, camera);
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);
})();