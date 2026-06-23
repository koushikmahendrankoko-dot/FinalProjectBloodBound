/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — boss.js
   Multi-phase boss encounters for all 5 chapters.
   Each boss has phase thresholds, unique attack patterns,
   and telegraphed wind-ups for fairness.
═══════════════════════════════════════════════════════════════ */

const BOSS_DEFS = {
  village_guardian: {
    name: 'The Village Guardian',
    maxHp: 200,
    speed: 1.3,
    color: '#8b1a24',
    size: 44,
    phases: [
      { threshold: 1.0, pattern: 'sweep' },
      { threshold: 0.5, pattern: 'pillars' }
    ]
  },
  hollow_beast: {
    name: 'The Hollow Beast',
    maxHp: 320,
    speed: 1.5,
    color: '#5a1a30',
    size: 52,
    phases: [
      { threshold: 1.0,  pattern: 'emerge' },
      { threshold: 0.6,  pattern: 'charge' },
      { threshold: 0.25, pattern: 'berserk' }
    ]
  },
  lord_vael: {
    name: 'Lord Vael',
    maxHp: 380,
    speed: 1.8,
    color: '#6a1020',
    size: 40,
    phases: [
      { threshold: 1.0,  pattern: 'sword' },
      { threshold: 0.65, pattern: 'summon' },
      { threshold: 0.3,  pattern: 'rune_reveal' }
    ]
  },
  blood_guardians: {
    name: 'The Four Guardians',
    maxHp: 450,
    speed: 1.2,
    color: '#7a1a28',
    size: 42,
    phases: [
      { threshold: 1.0,  pattern: 'flame' },
      { threshold: 0.75, pattern: 'stone' },
      { threshold: 0.5,  pattern: 'shadow' },
      { threshold: 0.25, pattern: 'blood' }
    ]
  },
  blood_god: {
    name: 'The Blood God',
    maxHp: 600,
    speed: 1.6,
    color: '#ff3347',
    size: 56,
    phases: [
      { threshold: 1.0,  pattern: 'orbs' },
      { threshold: 0.8,  pattern: 'fracture' },
      { threshold: 0.55, pattern: 'absorb' },
      { threshold: 0.3,  pattern: 'desperation' },
      { threshold: 0.1,  pattern: 'final' }
    ]
  }
};

class Boss {
  constructor(type, tx, ty) {
    this.type = type;
    this.def = BOSS_DEFS[type] || BOSS_DEFS.village_guardian;
    this.name = this.def.name;

    this.maxHp = this.def.maxHp;
    this.hp = this.def.maxHp;
    this.speed = this.def.speed;
    this.color = this.def.color;

    this.width = this.def.size;
    this.height = this.def.size;

    this.x = tx * Sprites.TILE_SIZE - this.width / 2;
    this.y = ty * Sprites.TILE_SIZE - this.height / 2;

    this.currentPhaseIndex = 0;
    this.phase = this.def.phases[0].pattern;
    this.phaseTransitioning = false;
    this.phaseTransitionTimer = 0;

    this.state = 'intro';
    this.introTimer = 1500;

    this.attackTimer = 2000;
    this.attackCooldown = 2000;
    this.windupTimer = 0;
    this.isWindingUp = false;
    this.currentAttack = null;

    this.facing = 'down';
    this.hurtTimer = 0;
    this.staggerTimer = 0;

    this.defeated = false;
    this.defeatTimer = 0;

    this.summonedMinions = [];
    this.dialogueShown = new Set();
  }

  get cx() { return this.x + this.width / 2; }
  get cy() { return this.y + this.height / 2; }

  getBounds() {
    return { x: this.x + 4, y: this.y + 4, w: this.width - 8, h: this.height - 8 };
  }

  takeDamage(amount) {
    if (this.defeated || this.state === 'intro') return;
    this.hp -= amount;
    this.hurtTimer = 200;

    if (this.hp <= 0) {
      this.hp = 0;
      this.defeated = true;
      this.defeatTimer = 0;
      Particles.bossPhaseTransition(this.cx, this.cy);
      return;
    }

    const hpRatio = this.hp / this.maxHp;
    const nextPhaseIdx = this.currentPhaseIndex + 1;
    if (nextPhaseIdx < this.def.phases.length && hpRatio <= this.def.phases[nextPhaseIdx].threshold) {
      this._transitionPhase(nextPhaseIdx);
    }
  }

  _transitionPhase(idx) {
    this.currentPhaseIndex = idx;
    this.phase = this.def.phases[idx].pattern;
    this.phaseTransitioning = true;
    this.phaseTransitionTimer = 1000;
    Particles.bossPhaseTransition(this.cx, this.cy);
  }

  update(dt, map, player, combat, enemyManager) {
    if (this.defeated) {
      this.defeatTimer += dt;
      return;
    }

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.state = 'active';
      return;
    }

    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    if (this.phaseTransitioning) {
      this.phaseTransitionTimer -= dt;
      if (this.phaseTransitionTimer <= 0) this.phaseTransitioning = false;
      return;
    }

    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      return;
    }

    this._updateFacing(player.cx, player.cy);
    this._runPattern(dt, map, player, combat, enemyManager);
  }

  _updateFacing(tx, ty) {
    const dx = tx - this.cx, dy = ty - this.cy;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  _runPattern(dt, map, player, combat, enemyManager) {
    this.attackTimer -= dt;

    if (!this.isWindingUp) {
      const dist = Math.hypot(player.cx - this.cx, player.cy - this.cy);
      if (dist > 70) {
        const dx = (player.cx - this.cx) / dist;
        const dy = (player.cy - this.cy) / dist;
        this.x += dx * this.speed;
        this.y += dy * this.speed;
      }
    }

    if (this.attackTimer <= 0 && !this.isWindingUp) {
      this._beginAttack(player);
    }

    if (this.isWindingUp) {
      this.windupTimer -= dt;
      if (this.windupTimer <= 0) {
        this._executeAttack(player, combat, enemyManager);
        this.isWindingUp = false;
        this.attackTimer = this.attackCooldown;
      }
    }
  }

  _beginAttack(player) {
    this.isWindingUp = true;

    switch (this.phase) {
      case 'sweep':        this.windupTimer = 700;  this.currentAttack = 'melee_sweep'; break;
      case 'pillars':      this.windupTimer = 900;  this.currentAttack = 'fire_pillars'; break;
      case 'emerge':       this.windupTimer = 600;  this.currentAttack = 'melee_sweep'; break;
      case 'charge':       this.windupTimer = 500;  this.currentAttack = 'charge'; break;
      case 'berserk':      this.windupTimer = 300;  this.currentAttack = 'rapid_melee'; break;
      case 'sword':        this.windupTimer = 500;  this.currentAttack = 'melee_sweep'; break;
      case 'summon':       this.windupTimer = 800;  this.currentAttack = 'summon_knights'; break;
      case 'rune_reveal':  this.windupTimer = 700;  this.currentAttack = 'rune_burst'; break;
      case 'flame':        this.windupTimer = 700;  this.currentAttack = 'fire_pillars'; break;
      case 'stone':        this.windupTimer = 600;  this.currentAttack = 'charge'; break;
      case 'shadow':       this.windupTimer = 500;  this.currentAttack = 'rapid_melee'; break;
      case 'blood':        this.windupTimer = 900;  this.currentAttack = 'blood_wave'; break;
      case 'orbs':         this.windupTimer = 700;  this.currentAttack = 'orb_barrage'; break;
      case 'fracture':     this.windupTimer = 600;  this.currentAttack = 'charge'; break;
      case 'absorb':       this.windupTimer = 1000; this.currentAttack = 'absorb_hp'; break;
      case 'desperation':  this.windupTimer = 400;  this.currentAttack = 'rapid_melee'; break;
      case 'final':        this.windupTimer = 1200; this.currentAttack = 'final_nova'; break;
      default:             this.windupTimer = 600;  this.currentAttack = 'melee_sweep';
    }
  }

  _executeAttack(player, combat, enemyManager) {
    const dist = Math.hypot(player.cx - this.cx, player.cy - this.cy);

    switch (this.currentAttack) {
      case 'melee_sweep':
        if (dist < this.width * 1.2) {
          player.takeDamage(14);
          Particles.playerHurt(player.cx, player.cy);
        }
        break;

      case 'fire_pillars': {
        for (let i = 0; i < 3; i++) {
          const px = player.cx + (Math.random() - 0.5) * 200;
          const py = player.cy + (Math.random() - 0.5) * 200;
          combat.activeEffects.push({
            type: 'hemorrhage', x: px, y: py, radius: 40,
            damage: 12, life: 600, tickTimer: 0, tickRate: 300, ownerId: 'boss'
          });
          Particles.hemorrhage(px, py);
        }
        break;
      }

      case 'charge': {
        const dx = (player.cx - this.cx), dy = (player.cy - this.cy);
        const d = Math.hypot(dx, dy) || 1;
        this.x += (dx/d) * 60;
        this.y += (dy/d) * 60;
        if (dist < this.width * 1.4) {
          player.takeDamage(20);
          Particles.playerHurt(player.cx, player.cy);
        }
        break;
      }

      case 'rapid_melee':
        if (dist < this.width * 1.1) {
          player.takeDamage(10);
          Particles.playerHurt(player.cx, player.cy);
        }
        this.attackCooldown = 700;
        break;

      case 'summon_knights':
        if (enemyManager) {
          const tx = Math.floor(this.cx / Sprites.TILE_SIZE);
          const ty = Math.floor(this.cy / Sprites.TILE_SIZE);
          enemyManager.enemies.push(new Enemy('grunt', tx - 2, ty));
          enemyManager.enemies.push(new Enemy('grunt', tx + 2, ty));
        }
        this.attackCooldown = 3500;
        break;

      case 'rune_burst':
        combat.activeEffects.push({
          type: 'hemorrhage', x: this.cx, y: this.cy, radius: 90,
          damage: 6, life: 1500, tickTimer: 0, tickRate: 300, ownerId: 'boss'
        });
        Particles.deathMark(this.cx, this.cy);
        break;

      case 'blood_wave':
        combat.projectiles.push(new Projectile({
          x: this.cx, y: this.cy,
          vx: (player.cx > this.cx ? 1 : -1) * 6, vy: 0,
          damage: 16, width: 20, height: 100,
          color: '#8b1a24', glowColor: '#ff3347',
          ownedByPlayer: false, piercing: true, isWave: true, life: 1200
        }));
        break;

      case 'orb_barrage':
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          combat.projectiles.push(new Projectile({
            x: this.cx, y: this.cy,
            vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
            damage: 12, width: 14, height: 14,
            color: '#ff3347', glowColor: '#ff6070',
            ownedByPlayer: false, life: 2500
          }));
        }
        break;

      case 'absorb_hp': {
        const drain = Math.min(15, player.hp - 1);
        if (drain > 0) {
          player.hp -= drain;
          this.hp = Math.min(this.maxHp, this.hp + drain * 2);
          Particles.deathMark(player.cx, player.cy);
        }
        break;
      }

      case 'final_nova':
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          combat.projectiles.push(new Projectile({
            x: this.cx, y: this.cy,
            vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
            damage: 18, width: 16, height: 16,
            color: '#ff9900', glowColor: '#ff3347',
            ownedByPlayer: false, life: 2500
          }));
        }
        Particles.bossPhaseTransition(this.cx, this.cy);
        break;
    }
  }

  render(ctx, camera) {
    if (this.defeated && this.defeatTimer > 800) return;

    ctx.save();
    if (this.defeated) ctx.globalAlpha = Math.max(0, 1 - this.defeatTimer / 800);
    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer / 50) % 2 === 0) {
      ctx.filter = 'brightness(2) saturate(2)';
    }
    if (this.state === 'intro') {
      ctx.globalAlpha = Math.min(1, 1 - this.introTimer / 1500);
    }

    if (window.Assets && window.Assets.hasImage('boss_' + this.type)) {
      const img = window.Assets.getImage('boss_' + this.type);
      const frameSize = 128;
      const framesPerRow = Math.max(1, Math.floor(img.width / frameSize));
      const frameIndex = Math.floor(Date.now() / 200) % framesPerRow;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.isWindingUp ? 20 : 8;
      ctx.drawImage(img, frameIndex * frameSize, 0, frameSize, frameSize, this.x, this.y, this.width, this.height);
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.isWindingUp ? 24 : 12;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(this.x + this.width*0.1, this.y + this.height*0.1, this.width*0.8, this.height*0.3);

      ctx.fillStyle = '#ffcc02';
      ctx.shadowColor = '#ffcc02';
      ctx.shadowBlur = 10;
      const eyeY = this.y + this.height * 0.3;
      ctx.fillRect(this.x + this.width*0.25, eyeY, this.width*0.12, this.height*0.1);
      ctx.fillRect(this.x + this.width*0.63, eyeY, this.width*0.12, this.height*0.1);
    }

    if (this.isWindingUp) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,80,80,.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.width * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

window.BOSS_DEFS = BOSS_DEFS;
window.Boss = Boss;