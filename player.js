/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — player.js (v3 — Elden Ring edition)
   Mouse-aimed attacks, dodge roll with i-frames + afterimage,
   parry window, lag HP bar, all original mechanics preserved.
═══════════════════════════════════════════════════════════════ */

class Player {
  constructor(saveData) {
    this.x = 100;
    this.y = 100;
    this.width  = 24;
    this.height = 28;

    this.maxHp      = saveData.maxHp      ?? 100;
    this.hp         = saveData.currentHp  ?? 100;
    this.lagHp      = this.hp;            // lag bar trails behind real HP
    this.baseAttack = saveData.baseAttack ?? 10;
    this.speed      = saveData.speed      ?? 3;

    this.abilities = saveData.abilities ?? {
      slot1: 'blood_surge', slot2: 'crimson_whirl', slot3: null, slot4: null
    };

    // Facing / aim
    this.facing   = 'down';
    this.aimAngle = Math.PI / 2; // radians toward mouse

    // ── ATTACK STATE MACHINE ──
    // windup → active → recovery → idle
    this.attackPhase    = 'idle'; // 'idle'|'windup'|'active'|'recovery'
    this.attackTimer    = 0;
    this.WINDUP_MS      = 80;
    this.ACTIVE_MS      = 100;
    this.RECOVERY_MS    = 160;
    this._resolveAttack = false; // consumed once by main.js on active frame

    // ── PARRY ──
    this.parryWindow    = false;
    this.parryTimer     = 0;
    this.PARRY_MS       = 180;  // parry window after right-click
    this.parryCooldown  = 0;
    this.PARRY_CD_MS    = 1200;
    this.parrySuccess   = false;
    this.parryFlashTimer= 0;

    // ── DODGE ROLL ──
    this.rolling        = false;
    this.rollTimer      = 0;
    this.ROLL_MS        = 320;
    this.rollCooldown   = 0;
    this.ROLL_CD_MS     = 600;
    this.rollVx         = 0;
    this.rollVy         = 0;
    this.ROLL_SPEED     = 7;
    this.afterimages    = []; // {x,y,alpha,facing}

    // ── HURT / INVINCIBILITY ──
    this.hurtTimer         = 0;
    this.HURT_DURATION     = 400;
    this.invincible        = false;
    this.invincibleTimer   = 0;
    this.INVINCIBLE_DURATION = 600;
    this.lastHurtDirX      = 0;
    this.lastHurtDirY      = 0;

    // ── KNOCKBACK ──
    this.knockVx = 0;
    this.knockVy = 0;

    // ── DEATH ──
    this.dead       = false;
    this.deathTimer = 0;

    // ── LAVA ──
    this.lavaDamageTick = 0;
    this.LAVA_TICK_RATE = 800;

    // ── FOOTSTEPS ──
    this.footstepTimer = 0;
    this.FOOTSTEP_MS   = 220;

    // ── INVENTORY ──
    this.bloodCoins   = saveData.bloodCoins ?? 0;
    this.smallPotions = saveData.inventory?.smallPotions ?? 0;
    this.largePotions = saveData.inventory?.largePotions ?? 0;
    this.reviveCharm  = saveData.inventory?.reviveCharm  ?? false;
    this.hasRevived   = false;

    // ── ANIMATION ──
    this.anim      = new Sprites.AnimationController(2, 180);
    this.isMoving  = false;

    // ── INPUT (set each frame by main.js) ──
    this.input = { up:false, down:false, left:false, right:false };
    this.mouseX = 0; // world-space mouse position
    this.mouseY = 0;
  }

  get cx() { return this.x + this.width  / 2; }
  get cy() { return this.y + this.height / 2; }

  getBounds() {
    return { x: this.x+4, y: this.y+8, w: this.width-8, h: this.height-10 };
  }

  /* ── UPDATE ── */
  update(dt, map, combat, saveData) {
    if (this.dead) { this.deathTimer += dt; return; }

    // Lag HP bar trails real HP
    if (this.lagHp > this.hp) {
      this.lagHp = Math.max(this.hp, this.lagHp - (this.maxHp * 0.08) * (dt / 1000) * 60);
    }

    // Timers
    if (this.invincible)      { this.invincibleTimer -= dt; if (this.invincibleTimer <= 0) this.invincible = false; }
    if (this.hurtTimer   > 0) this.hurtTimer   -= dt;
    if (this.parryCooldown>0) this.parryCooldown-= dt;
    if (this.rollCooldown > 0)this.rollCooldown -= dt;
    if (this.parryFlashTimer>0)this.parryFlashTimer-=dt;

    // Parry window
    if (this.parryWindow) {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) { this.parryWindow = false; }
    }

    // Attack state machine
    this._tickAttack(dt);

    // Dodge roll
    if (this.rolling) {
      this._tickRoll(dt, map);
    } else {
      this._handleMovement(dt, map);
    }

    // Knockback decay
    if (Math.abs(this.knockVx) > 0.1 || Math.abs(this.knockVy) > 0.1) {
      this._tryMove(this.knockVx, this.knockVy, map);
      this.knockVx *= 0.78;
      this.knockVy *= 0.78;
    }

    this._handleTileEffects(dt, map);
    this._updateAimFacing();

    // Footstep dust
    if (this.isMoving && !this.rolling) {
      this.footstepTimer += dt;
      if (this.footstepTimer >= this.FOOTSTEP_MS) {
        this.footstepTimer = 0;
        if (window.Particles) Particles.footstepDust(this.cx, this.y + this.height);
      }
    } else {
      this.footstepTimer = 0;
    }

    this.anim.update(dt, this.isMoving || this.rolling);
  }

  _tickAttack(dt) {
    if (this.attackPhase === 'idle') return;
    this.attackTimer -= dt;
    if (this.attackPhase === 'windup' && this.attackTimer <= 0) {
      this.attackPhase    = 'active';
      this.attackTimer    = this.ACTIVE_MS;
      this._resolveAttack = true; // signal main.js to fire combat.basicAttack
    } else if (this.attackPhase === 'active' && this.attackTimer <= 0) {
      this.attackPhase = 'recovery';
      this.attackTimer = this.RECOVERY_MS;
    } else if (this.attackPhase === 'recovery' && this.attackTimer <= 0) {
      this.attackPhase = 'idle';
    }
  }

  _tickRoll(dt, map) {
    this.rollTimer -= dt;

    // Spawn afterimage every 40ms
    if (Math.floor(this.rollTimer / 40) !== Math.floor((this.rollTimer + dt) / 40)) {
      this.afterimages.push({ x: this.x, y: this.y, alpha: 0.55, facing: this.facing });
    }

    this._tryMove(this.rollVx, this.rollVy, map);

    // Fade afterimages
    for (const a of this.afterimages) a.alpha -= 0.04;
    this.afterimages = this.afterimages.filter(a => a.alpha > 0);

    if (this.rollTimer <= 0) {
      this.rolling = false;
      this.invincible = false;
    }
  }

  _handleMovement(dt, map) {
    const { up, down, left, right } = this.input;
    let dx = 0, dy = 0;
    if (left)  dx -= 1;
    if (right) dx += 1;
    if (up)    dy -= 1;
    if (down)  dy += 1;

    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
    this.isMoving = dx !== 0 || dy !== 0;

    const slowDuringAttack = this.attackPhase === 'windup' || this.attackPhase === 'active';
    const onWater = map.tileAt(this.cx, this.cy) === TileTypes.WATER;
    const speed   = this.speed * (onWater ? 0.5 : 1) * (slowDuringAttack ? 0.4 : 1);

    this._tryMove(dx * speed, dy * speed, map);
  }

  _tryMove(moveX, moveY, map) {
    const nx = this.x + moveX;
    const ny = this.y + moveY;
    if (!map.rectSolid(nx+4, this.y+8, this.width-8, this.height-10)) this.x = nx;
    if (!map.rectSolid(this.x+4, ny+8, this.width-8, this.height-10)) this.y = ny;
  }

  _handleTileEffects(dt, map) {
    const tile = map.tileAt(this.cx, this.cy + this.height * 0.3);
    if (tile === TileTypes.LAVA) {
      this.lavaDamageTick += dt;
      if (this.lavaDamageTick >= this.LAVA_TICK_RATE) {
        this.lavaDamageTick = 0;
        this.takeDamage(8, true);
        if (window.Particles) Particles.lavaDamage(this.cx, this.cy);
      }
    } else {
      this.lavaDamageTick = 0;
    }
  }

  _updateAimFacing() {
    const dx = this.mouseX - this.cx;
    const dy = this.mouseY - this.cy;
    this.aimAngle = Math.atan2(dy, dx);
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX > absY) this.facing = dx > 0 ? 'right' : 'left';
    else             this.facing = dy > 0 ? 'down'  : 'up';
  }

  /* ── TRIGGER BASIC ATTACK (called on mouse click) ── */
  triggerAttack() {
    if (this.attackPhase !== 'idle') return false;
    if (this.rolling) return false;
    this.attackPhase = 'windup';
    this.attackTimer = this.WINDUP_MS;
    return true;
  }

  /* Returns true once, on the active frame — consumed by main.js */
  consumeAttackResolve() {
    if (this._resolveAttack) { this._resolveAttack = false; return true; }
    return false;
  }

  /* ── PARRY (right-click) ── */
  triggerParry() {
    if (this.parryCooldown > 0) return false;
    if (this.rolling) return false;
    this.parryWindow  = true;
    this.parryTimer   = this.PARRY_MS;
    this.parryCooldown= this.PARRY_CD_MS;
    if (window.Particles) Particles.parryReady(this.cx, this.cy);
    return true;
  }

  /* Called by combat.js when an enemy attack lands during parry window */
  resolveParry(attacker) {
    if (!this.parryWindow) return false;
    this.parryWindow     = false;
    this.parrySuccess    = true;
    this.parryFlashTimer = 400;
    // Stagger attacker
    if (attacker && attacker.stagger) attacker.stagger(800);
    if (window.Particles) Particles.parrySuccess(this.cx, this.cy);
    if (window.__activeCamera) window.__activeCamera.shake(6, 220);
    return true;
  }

  /* ── DODGE ROLL (Shift or double-tap) ── */
  triggerRoll() {
    if (this.rolling) return false;
    if (this.rollCooldown > 0) return false;
    const { up, down, left, right } = this.input;
    let dx = 0, dy = 0;
    if (left)  dx -= 1;
    if (right) dx += 1;
    if (up)    dy -= 1;
    if (down)  dy += 1;
    if (dx === 0 && dy === 0) { // roll away from mouse if standing still
      dx = -Math.cos(this.aimAngle);
      dy = -Math.sin(this.aimAngle);
    }
    const len = Math.hypot(dx, dy) || 1;
    this.rollVx       = (dx/len) * this.ROLL_SPEED;
    this.rollVy       = (dy/len) * this.ROLL_SPEED;
    this.rolling      = true;
    this.rollTimer    = this.ROLL_MS;
    this.rollCooldown = this.ROLL_CD_MS;
    this.invincible   = true;
    this.invincibleTimer = this.ROLL_MS;
    if (window.Particles) Particles.rollDust(this.cx, this.cy);
    return true;
  }

  /* ── TAKE DAMAGE ── */
  takeDamage(amount, bypassInvincibility = false, sourceX = null, sourceY = null) {
    if (this.dead) return;
    if (this.invincible && !bypassInvincibility) return;

    // Parry check
    if (this.parryWindow && !bypassInvincibility) {
      this.resolveParry(null);
      return;
    }

    this.hp -= amount;
    this.hurtTimer = this.HURT_DURATION;

    // Knockback away from source
    if (sourceX !== null && sourceY !== null) {
      const dx = this.cx - sourceX, dy = this.cy - sourceY;
      const len = Math.hypot(dx,dy)||1;
      this.knockVx = (dx/len)*4;
      this.knockVy = (dy/len)*4;
      this.lastHurtDirX = dx/len;
      this.lastHurtDirY = dy/len;
    }

    if (!bypassInvincibility) {
      this.invincible      = true;
      this.invincibleTimer = this.INVINCIBLE_DURATION;
    }

    if (this.hp <= 0) {
      if (this.reviveCharm && !this.hasRevived) {
        this.hp          = Math.floor(this.maxHp * 0.5);
        this.hasRevived  = true;
        this.invincible  = true;
        this.invincibleTimer = 2000;
        if (window.Particles) Particles.sanguineSacrifice(this.cx, this.cy);
        return;
      }
      this.hp   = 0;
      this.dead = true;
    }
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  usePotion() {
    if (this.largePotions > 0) {
      this.largePotions--;
      this.heal(80);
      if (window.Particles) Particles.bloodCoinPickup(this.cx, this.cy);
      return true;
    }
    if (this.smallPotions > 0) {
      this.smallPotions--;
      this.heal(30);
      if (window.Particles) Particles.bloodCoinPickup(this.cx, this.cy);
      return true;
    }
    return false;
  }

  setPosition(tx, ty) {
    this.x = tx * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.width)  / 2;
    this.y = ty * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.height) / 2;
  }

  /* ── RENDER ── */
  render(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    // Afterimage trail (dodge roll)
    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = a.alpha * 0.6;
      ctx.filter = 'brightness(0.4) sepia(1) saturate(6) hue-rotate(-20deg)';
      const rs = this.width * 2.2;
      const rx = a.x - (rs - this.width) / 2;
      const ry = a.y - (rs * 1.1 - this.height);
      Sprites.drawPlayerSprite(ctx, a.facing, 0, rx, ry, rs, false);
      ctx.restore();
    }

    // Parry flash
    if (this.parryFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = (this.parryFlashTimer / 400) * 0.5;
      ctx.shadowColor = '#ffcc02';
      ctx.shadowBlur  = 30;
      ctx.fillStyle   = 'rgba(255,204,2,.3)';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 24, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();

    // Hurt flash
    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer/80)%2===0) {
      ctx.filter = 'brightness(3) sepia(1) saturate(10) hue-rotate(-30deg)';
    }
    // Invincibility blink
    if (this.invincible && !this.rolling && Math.floor(this.invincibleTimer/60)%2===0) {
      ctx.globalAlpha = 0.4;
    }
    // Roll squash
    if (this.rolling) {
      const progress = 1 - this.rollTimer / this.ROLL_MS;
      ctx.translate(this.cx, this.cy + this.height * 0.5);
      ctx.scale(1 + progress * 0.3, 0.7 + progress * 0.3);
      ctx.translate(-this.cx, -(this.cy + this.height * 0.5));
    }
    // Death fade
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathTimer/800);

    // Windup telegraph — red tint
    if (this.attackPhase === 'windup') {
      ctx.filter = 'brightness(1.4) sepia(.5) saturate(4) hue-rotate(-10deg)';
    }

    const renderSize = this.width * 2.2;
    const rx = this.x - (renderSize - this.width) / 2;
    const ry = this.y - (renderSize * 1.1 - this.height);
    Sprites.drawPlayerSprite(ctx, this.facing, this.anim.currentFrame, rx, ry, renderSize, this.attackPhase === 'active');

    ctx.restore();

    // Parry ring indicator
    if (this.parryWindow) {
      ctx.save();
      const progress = 1 - this.parryTimer / this.PARRY_MS;
      ctx.globalAlpha = 0.7 - progress * 0.5;
      ctx.strokeStyle = '#ffcc02';
      ctx.lineWidth   = 2;
      ctx.shadowColor = '#ffcc02';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 20 + progress * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ground rune glow
    if (!this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(Date.now() * 0.003);
      ctx.shadowColor = '#ff3347';
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = 'rgba(255,51,71,.15)';
      ctx.beginPath();
      ctx.ellipse(this.cx, this.y + this.height, this.width*0.6, this.height*0.15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderHpBar(ctx) {
    if (this.dead || this.hp >= this.maxHp) return;
    const bw = 32, bh = 5;
    const bx = this.cx - bw/2;
    const by = this.y - 12;
    const pct    = Math.max(0, this.hp    / this.maxHp);
    const lagPct = Math.max(0, this.lagHp / this.maxHp);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(bx, by, bw, bh);
    // Lag bar (yellow)
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(bx, by, Math.round(bw * lagPct), bh);
    // Real HP
    ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(bx, by, Math.round(bw * pct), bh);
  }
}

window.Player = Player;