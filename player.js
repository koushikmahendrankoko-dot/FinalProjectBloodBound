/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — player.js
   Player entity: movement, HP management, ability use,
   collision with map, sprite rendering, hurt/death state
═══════════════════════════════════════════════════════════════ */

class Player {
  constructor(saveData) {
    // Position (world pixels, top-left of bounding box)
    this.x = 100;
    this.y = 100;
    this.width  = 24;
    this.height = 28;

    // Stats from save
    this.maxHp     = saveData.maxHp     ?? 100;
    this.hp        = saveData.currentHp ?? 100;
    this.baseAttack= saveData.baseAttack ?? 10;
    this.speed     = saveData.speed      ?? 3;

    // Abilities
    this.abilities = saveData.abilities ?? {
      slot1: 'blood_surge',
      slot2: 'crimson_whirl',
      slot3: null,
      slot4: null
    };

    // Facing direction for attacks
    this.facing = 'down';

    // Animation
    this.anim = new Sprites.AnimationController(2, 180);
    this.isMoving = false;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.ATTACK_DURATION = 300;

    // Hurt flash
    this.hurtTimer = 0;
    this.HURT_DURATION = 400;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.INVINCIBLE_DURATION = 600; // ms after being hit

    // Death
    this.dead = false;
    this.deathTimer = 0;

    // Lava damage tick
    this.lavaDamageTick = 0;
    this.LAVA_TICK_RATE = 800;

    // Input snapshot (set by main.js input handler)
    this.input = { up: false, down: false, left: false, right: false, attack: false, interact: false };

    // Blood coins (runtime, synced to saveData)
    this.bloodCoins = saveData.bloodCoins ?? 0;

    // Potions
    this.smallPotions = saveData.inventory?.smallPotions ?? 0;
    this.largePotions = saveData.inventory?.largePotions ?? 0;
    this.reviveCharm  = saveData.inventory?.reviveCharm ?? false;
    this.hasRevived   = false;
  }

  /* ── GETTERS (center x/y for combat/particles) ── */
  get cx() { return this.x + this.width / 2; }
  get cy() { return this.y + this.height / 2; }

  getBounds() {
    // Slightly inset hitbox for more forgiving collisions
    return { x: this.x + 4, y: this.y + 8, w: this.width - 8, h: this.height - 10 };
  }

  /* ── UPDATE ── */
  update(dt, map, combat, saveData) {
    if (this.dead) { this.deathTimer += dt; return; }

    // Invincibility frames after being hit
    if (this.invincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) this.invincible = false;
    }

    // Hurt flash timer
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // Attack animation timer
    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.isAttacking = false;
    }

    this._handleMovement(dt, map);
    this._handleTileEffects(dt, map);

    // Potion use (Q key handled in main.js, triggers usePotion)
  }

  _handleMovement(dt, map) {
    const { up, down, left, right } = this.input;
    let dx = 0, dy = 0;

    if (left)  dx -= 1;
    if (right) dx += 1;
    if (up)    dy -= 1;
    if (down)  dy += 1;

    // Diagonal normalization
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    this.isMoving = dx !== 0 || dy !== 0;

    if (this.isMoving) {
      // Update facing direction
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx > 0 ? 'right' : 'left';
      } else {
        this.facing = dy > 0 ? 'down' : 'up';
      }
    }

    // Water slows the player
    const onWater = map.tileAt(this.cx, this.cy) === TileTypes.WATER;
    const speed = this.speed * (onWater ? 0.5 : 1);

    const moveX = dx * speed;
    const moveY = dy * speed;

    // Separate axis collision resolution
    this._moveAxis('x', moveX, map);
    this._moveAxis('y', moveY, map);

    this.anim.update(dt, this.isMoving);
  }

  _moveAxis(axis, delta, map) {
    if (delta === 0) return;
    const nextX = axis === 'x' ? this.x + delta : this.x;
    const nextY = axis === 'y' ? this.y + delta : this.y;

    if (!map.rectSolid(nextX + 4, nextY + 8, this.width - 8, this.height - 10)) {
      this.x = nextX;
      this.y = nextY;
    }
  }

  _handleTileEffects(dt, map) {
    const tile = map.tileAt(this.cx, this.cy + this.height * 0.3);

    if (tile === TileTypes.LAVA) {
      this.lavaDamageTick += dt;
      if (this.lavaDamageTick >= this.LAVA_TICK_RATE) {
        this.lavaDamageTick = 0;
        this.takeDamage(8, true); // bypass invincibility for lava
        Particles.lavaDamage(this.cx, this.cy);
      }
    } else {
      this.lavaDamageTick = 0;
    }
  }

  /* ── TRIGGER BASIC ATTACK ── */
  triggerAttack() {
    if (this.isAttacking) return false;
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_DURATION;
    return true;
  }

  /* ── TAKE DAMAGE ── */
  takeDamage(amount, bypassInvincibility = false) {
    if (this.dead) return;
    if (this.invincible && !bypassInvincibility) return;

    this.hp -= amount;
    this.hurtTimer = this.HURT_DURATION;

    if (!bypassInvincibility) {
      this.invincible = true;
      this.invincibleTimer = this.INVINCIBLE_DURATION;
    }

    if (this.hp <= 0) {
      // Check for revival charm
      if (this.reviveCharm && !this.hasRevived) {
        this.hp = Math.floor(this.maxHp * 0.5);
        this.hasRevived = true;
        this.invincible = true;
        this.invincibleTimer = 2000;
        Particles.sanguineSacrifice(this.cx, this.cy);
        return;
      }
      this.hp = 0;
      this.dead = true;
    }
  }

  /* ── HEAL ── */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /* ── USE POTION ── */
  usePotion() {
    if (this.largePotions > 0) {
      this.largePotions--;
      this.heal(80);
      Particles.bloodCoinPickup(this.cx, this.cy);
      return true;
    }
    if (this.smallPotions > 0) {
      this.smallPotions--;
      this.heal(30);
      Particles.bloodCoinPickup(this.cx, this.cy);
      return true;
    }
    return false;
  }

  /* ── PLACE PLAYER AT TILE POSITION ── */
  setPosition(tx, ty) {
    this.x = tx * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.width) / 2;
    this.y = ty * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.height) / 2;
  }

  /* ── SYNC STATS BACK TO SAVE DATA ── */
  syncToSave(saveData) {
    saveData.currentHp     = this.hp;
    saveData.bloodCoins    = this.bloodCoins;
    saveData.inventory.smallPotions = this.smallPotions;
    saveData.inventory.largePotions = this.largePotions;
  }

  /* ── RENDER ── */
  render(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    ctx.save();

    // Hurt flash — blink red
    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer / 80) % 2 === 0) {
      ctx.filter = 'brightness(3) sepia(1) saturate(10) hue-rotate(-30deg)';
    }

    // Invincibility blink
    if (this.invincible && Math.floor(this.invincibleTimer / 60) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Death fade
    if (this.dead) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 800);
    }

    const renderSize = this.width * 2.2;
    const rx = this.x - (renderSize - this.width) / 2;
    const ry = this.y - (renderSize * 1.1 - this.height);

    Sprites.drawPlayerSprite(
      ctx,
      this.facing,
      this.anim.currentFrame,
      rx, ry,
      renderSize,
      this.isAttacking
    );

    ctx.restore();

    // Blood rune glow under the player
    if (!this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.003);
      ctx.shadowColor = '#ff3347';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(255,51,71,.18)';
      ctx.beginPath();
      ctx.ellipse(this.cx, this.y + this.height, this.width * 0.6, this.height * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── HP BAR (rendered above player in world space) ── */
  renderHpBar(ctx) {
    if (this.dead || this.hp >= this.maxHp) return;
    const bw = 32, bh = 4;
    const bx = this.cx - bw/2;
    const by = this.y - 10;
    const pct = this.hp / this.maxHp;

    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(bx, by, Math.round(bw * pct), bh);
  }
}

window.Player = Player;