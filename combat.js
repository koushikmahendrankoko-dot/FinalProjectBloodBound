/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — combat.js
   Attack system, blood abilities, hitboxes, damage numbers,
   cooldown tracking, projectiles, ability definitions
═══════════════════════════════════════════════════════════════ */

/* ── ABILITY DEFINITIONS ── */
const ABILITIES = {
  blood_surge: {
    name: 'Blood Surge',
    icon: '⚡',
    hpCost: 10,
    cooldown: 1500,
    damage: 2.5,       // multiplier of base attack
    range: 60,
    type: 'melee',
    effect: 'single',
    description: 'Powerful forward strike. 2.5× damage.'
  },
  crimson_whirl: {
    name: 'Crimson Whirl',
    icon: '🌀',
    hpCost: 15,
    cooldown: 3000,
    damage: 1.8,
    range: 50,
    type: 'melee',
    effect: 'aoe360',
    description: '360° spin attack. Hits all nearby enemies.'
  },
  lifesteal: {
    name: 'Lifesteal',
    icon: '🩸',
    hpCost: 5,
    cooldown: 2000,
    damage: 1.2,
    range: 55,
    type: 'melee',
    effect: 'lifesteal',
    healRatio: 0.5,
    description: 'Strike and absorb life force. Heals 50% of damage dealt.'
  },
  hemorrhage: {
    name: 'Hemorrhage',
    icon: '🔥',
    hpCost: 20,
    cooldown: 5000,
    damage: 8,         // per tick (DoT)
    range: 80,
    type: 'aura',
    effect: 'dot',
    duration: 3000,
    tickRate: 300,
    description: 'Blood aura burns nearby enemies for 3s.'
  },
  death_mark: {
    name: 'Death Mark',
    icon: '💀',
    hpCost: 25,
    cooldown: 8000,
    damage: 0,
    range: 100,
    type: 'debuff',
    effect: 'mark',
    markDuration: 8000,
    damageMultiplier: 2,
    description: 'Brand an enemy — they take 2× damage for 8s.'
  },
  blood_tide: {
    name: 'Blood Tide',
    icon: '🌊',
    hpCost: 30,
    cooldown: 10000,
    damage: 5.0,
    range: 9999,
    type: 'projectile',
    effect: 'wave',
    description: 'Screen-wide blood wave. Pierces all enemies.'
  },
  sanguine_sacrifice: {
    name: 'Sanguine Sacrifice',
    icon: '☠',
    hpCost: 50,
    cooldown: 15000,
    damage: 150,
    range: 9999,
    type: 'aoe',
    effect: 'sacrifice',
    description: 'Sacrifice 50 HP to deal 150 damage to ALL enemies on screen.'
  }
};

/* ── PROJECTILE CLASS ── */
class Projectile {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.damage = opts.damage ?? 10;
    this.width = opts.width ?? 12;
    this.height = opts.height ?? 12;
    this.color = opts.color ?? '#ff3347';
    this.glowColor = opts.glowColor ?? '#ff6070';
    this.ownedByPlayer = opts.ownedByPlayer ?? true;
    this.piercing = opts.piercing ?? false;
    this.hitEnemies = new Set(); // for piercing
    this.life = opts.life ?? 2000;
    this.dead = false;
    this.shape = opts.shape ?? 'circle'; // 'circle' | 'rect'
    this.rotation = opts.rotation ?? 0;
    this.isWave = opts.isWave ?? false;
    this.marksTarget = opts.marksTarget ?? false;
  }

  update(dt, map) {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= dt;

    if (this.life <= 0) { this.dead = true; return; }

    // Wall collision (non-piercing wave just hits everything)
    if (!this.isWave && map && map.isSolid(this.x, this.y)) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;

    if (this.shape === 'rect') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
    } else if (this.isWave) {
      // Wave: tall thin rect sweeping rightward
      const alpha = Math.min(1, this.life / 200);
      ctx.globalAlpha = alpha;
      ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  getBounds() {
    return { x: this.x - this.width/2, y: this.y - this.height/2, w: this.width, h: this.height };
  }
}

/* ── COMBAT MANAGER ── */
class CombatManager {
  constructor() {
    this.projectiles = [];
    this.damageNumbers = [];   // { x, y, text, color, life, vy }
    this.cooldowns = {};        // abilityKey -> ms remaining
    this.activeEffects = [];   // { type, x, y, radius, damage, life, tickTimer }
    this.marks = new Map();    // enemyId -> { damage multiplier, life }
  }

  /* ── COOLDOWN TRACKING ── */
  startCooldown(abilityKey) {
    const ability = ABILITIES[abilityKey];
    if (!ability) return;
    let cd = ability.cooldown;
    // Relic: Vial of the Ancients reduces cost by 2
    this.cooldowns[abilityKey] = cd;
  }

  updateCooldowns(dt) {
    for (const key in this.cooldowns) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }
  }

  isReady(abilityKey) {
    return !this.cooldowns[abilityKey] || this.cooldowns[abilityKey] <= 0;
  }

  getCooldownProgress(abilityKey) {
    const ability = ABILITIES[abilityKey];
    if (!ability || this.isReady(abilityKey)) return 1;
    return 1 - this.cooldowns[abilityKey] / ability.cooldown;
  }

  /* ── BASIC ATTACK ── */
  basicAttack(player, enemies, camera) {
    const REACH = 56;
    const HALF_ARC = 50; // degrees each side
    let hit = false;

    const dirMap = { down: Math.PI/2, up: -Math.PI/2, left: Math.PI, right: 0 };
    const attackAngle = dirMap[player.facing] ?? 0;

    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.cx - player.cx;
      const dy = e.cy - player.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > REACH) continue;

      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(this._angleDiff(angle, attackAngle));
      if (diff > HALF_ARC * Math.PI / 180) continue;

      const dmg = this._applyMark(e.id, player.baseAttack);
      this.dealDamage(e, dmg, '#ffe070', 'normal');
      Particles.hitSpark(e.cx, e.cy);
      Particles.bloodSplatter(e.cx, e.cy, 0.7);
      hit = true;
    }

    if (hit) camera.shake(3, 120);
    return hit;
  }

  /* ── USE ABILITY ── */
  useAbility(abilityKey, player, enemies, camera, saveData) {
    const ability = ABILITIES[abilityKey];
    if (!ability) return false;
    if (!this.isReady(abilityKey)) return false;

    // HP cost (with Vial of Ancients relic reduction)
    let cost = ability.hpCost;
    if (saveData?.relics?.includes('vial_of_ancients')) cost = Math.max(1, cost - 2);

    if (player.hp <= cost) {
      this.showDamageNumber(player.cx, player.cy - 30, 'Not enough HP!', '#ff6070', 'text');
      return false;
    }

    // Deduct HP
    player.hp -= cost;
    saveData.stats.hpSacrificed = (saveData.stats.hpSacrificed || 0) + cost;

    // Blood coin buff: Crimson Crown relic — double power at low HP
    const crimsonCrown = saveData?.relics?.includes('crimson_crown') && player.hp / player.maxHp < 0.25;
    const damageMult = crimsonCrown ? 1.5 : 1;

    switch (ability.effect) {
      case 'single':
        this._castSingle(ability, player, enemies, camera, damageMult);
        Particles.bloodSurge(player.cx, player.cy, ...this._dirVec(player.facing));
        break;

      case 'aoe360':
        this._castAoe360(ability, player, enemies, camera, damageMult);
        Particles.crimsonWhirl(player.cx, player.cy);
        camera.shake(4, 200);
        break;

      case 'lifesteal':
        const healed = this._castLifesteal(ability, player, enemies, camera, damageMult);
        if (healed > 0) this.showDamageNumber(player.cx, player.cy - 30, `+${healed}`, '#2ecc71', 'heal');
        break;

      case 'dot':
        this._castDot(ability, player, damageMult);
        break;

      case 'mark':
        this._castMark(ability, player, enemies);
        Particles.deathMark(player.cx, player.cy);
        break;

      case 'wave':
        this._castWave(ability, player, damageMult);
        Particles.bloodTide(player.cx, player.cy, 2000);
        camera.shake(8, 400);
        break;

      case 'sacrifice':
        this._castSacrifice(ability, player, enemies, camera, damageMult);
        Particles.sanguineSacrifice(player.cx, player.cy);
        camera.shake(12, 600);
        break;
    }

    this.startCooldown(abilityKey);
    return true;
  }

  _castSingle(ability, player, enemies, camera, mult) {
    const [dvx, dvy] = this._dirVec(player.facing);
    let hit = false;

    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.cx - player.cx;
      const dy = e.cy - player.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > ability.range) continue;

      // Check roughly in facing direction
      const dot = dx * dvx + dy * dvy;
      if (dot < 0) continue;

      const dmg = Math.round(player.baseAttack * ability.damage * mult);
      const finalDmg = this._applyMark(e.id, dmg);
      this.dealDamage(e, finalDmg, '#ff6070', 'blood');
      Particles.bloodSplatter(e.cx, e.cy, 1.5);
      hit = true;
    }
    if (hit) camera.shake(5, 180);
  }

  _castAoe360(ability, player, enemies, camera, mult) {
    let hit = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.cx - player.cx, e.cy - player.cy);
      if (dist > ability.range) continue;
      const dmg = Math.round(player.baseAttack * ability.damage * mult);
      const finalDmg = this._applyMark(e.id, dmg);
      this.dealDamage(e, finalDmg, '#ff3347', 'blood');
      e.stagger(300);
      Particles.bloodSplatter(e.cx, e.cy, 1);
      hit = true;
    }
  }

  _castLifesteal(ability, player, enemies, camera, mult) {
    let totalHeal = 0;
    let hit = false;
    const [dvx, dvy] = this._dirVec(player.facing);

    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.cx - player.cx;
      const dy = e.cy - player.cy;
      if (Math.hypot(dx, dy) > ability.range) continue;
      const dot = dx * dvx + dy * dvy;
      if (dot < 0) continue;

      const dmg = Math.round(player.baseAttack * ability.damage * mult);
      const finalDmg = this._applyMark(e.id, dmg);
      this.dealDamage(e, finalDmg, '#cc00aa', 'blood');
      totalHeal += Math.round(finalDmg * ability.healRatio);
      Particles.hitSpark(e.cx, e.cy);
      hit = true;
    }

    if (hit) {
      player.hp = Math.min(player.maxHp, player.hp + totalHeal);
    }
    return totalHeal;
  }

  _castDot(ability, player, mult) {
    this.activeEffects.push({
      type: 'hemorrhage',
      x: player.cx, y: player.cy,
      radius: ability.range,
      damage: ability.damage * mult,
      life: ability.duration,
      tickTimer: 0,
      tickRate: ability.tickRate,
      ownerId: 'player'
    });
  }

  _castMark(ability, player, enemies) {
    // Find closest enemy in range
    let closest = null, closestDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.cx - player.cx, e.cy - player.cy);
      if (dist < ability.range && dist < closestDist) {
        closest = e; closestDist = dist;
      }
    }
    if (closest) {
      this.marks.set(closest.id, {
        multiplier: ability.damageMultiplier,
        life: ability.markDuration
      });
      Particles.deathMark(closest.cx, closest.cy);
    }
  }

  _castWave(ability, player, mult) {
    const speed = 12;
    this.projectiles.push(new Projectile({
      x: player.cx, y: player.cy,
      vx: speed, vy: 0,
      damage: Math.round(player.baseAttack * ability.damage * mult),
      width: 24, height: 120,
      color: '#cc0020', glowColor: '#ff3347',
      ownedByPlayer: true,
      piercing: true,
      isWave: true,
      life: 1500
    }));
  }

  _castSacrifice(ability, player, enemies, camera, mult) {
    const dmg = Math.round(ability.damage * mult);
    for (const e of enemies) {
      if (e.dead) continue;
      const finalDmg = this._applyMark(e.id, dmg);
      this.dealDamage(e, finalDmg, '#ff9900', 'crit');
      Particles.bloodSplatter(e.cx, e.cy, 2);
    }
  }

  /* ── APPLY MARK MULTIPLIER ── */
  _applyMark(enemyId, baseDmg) {
    const mark = this.marks.get(enemyId);
    if (!mark) return baseDmg;
    return Math.round(baseDmg * mark.multiplier);
  }

  /* ── DEAL DAMAGE TO ENTITY ── */
  dealDamage(entity, amount, color = '#ff6070', type = 'normal') {
    if (!entity || entity.dead) return;
    entity.takeDamage(amount);
    this.showDamageNumber(
      entity.cx + (Math.random() - 0.5) * 20,
      entity.cy - 20,
      amount.toString(),
      color,
      type
    );
  }

  /* ── DAMAGE NUMBERS ── */
  showDamageNumber(x, y, text, color, type = 'normal') {
    this.damageNumbers.push({
      x, y,
      text,
      color,
      type,
      life: 900,
      maxLife: 900,
      vy: -1.5 - Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.8,
      scale: type === 'crit' ? 1.4 : type === 'text' ? 1 : 1
    });
  }

  /* ── UPDATE LOOP ── */
  update(dt, map, player, enemies) {
    this.updateCooldowns(dt);

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, map);

      if (!p.dead) {
        // Check against enemies (player projectiles)
        if (p.ownedByPlayer) {
          for (const e of enemies) {
            if (e.dead) continue;
            if (p.hitEnemies.has(e.id)) continue;

            const b = p.getBounds();
            const eb = e.getBounds();
            if (this._rectsOverlap(b, eb)) {
              const finalDmg = this._applyMark(e.id, p.damage);
              this.dealDamage(e, finalDmg, '#ff3347', 'blood');
              Particles.bloodSplatter(e.cx, e.cy, 1);
              if (p.piercing) {
                p.hitEnemies.add(e.id);
              } else {
                p.dead = true;
                break;
              }
            }
          }
        } else {
          // Enemy projectile vs player
          if (player && !player.invincible) {
            const b = p.getBounds();
            const pb = player.getBounds();
            if (this._rectsOverlap(b, pb)) {
              player.takeDamage(p.damage);
              Particles.playerHurt(player.cx, player.cy);
              p.dead = true;
            }
          }
        }
      }

      if (p.dead) this.projectiles.splice(i, 1);
    }

    // Active DoT/Aura effects
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const eff = this.activeEffects[i];
      eff.life -= dt;
      eff.tickTimer -= dt;

      if (eff.type === 'hemorrhage') {
        if (eff.tickTimer <= 0) {
          eff.tickTimer = eff.tickRate;
          for (const e of enemies) {
            if (e.dead) continue;
            const dist = Math.hypot(e.cx - eff.x, e.cy - eff.y);
            if (dist <= eff.radius) {
              this.dealDamage(e, eff.damage, '#ff8030', 'normal');
            }
          }
          Particles.hemorrhage(eff.x, eff.y);
        }
      }

      if (eff.life <= 0) this.activeEffects.splice(i, 1);
    }

    // Damage marks
    for (const [id, mark] of this.marks) {
      mark.life -= dt;
      if (mark.life <= 0) this.marks.delete(id);
    }

    // Damage numbers float upward
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.x += d.vx;
      d.y += d.vy;
      d.life -= dt;
      if (d.life <= 0) this.damageNumbers.splice(i, 1);
    }
  }

  /* ── RENDER PROJECTILES ── */
  renderProjectiles(ctx) {
    for (const p of this.projectiles) p.draw(ctx);
  }

  /* ── RENDER DAMAGE NUMBERS (screen-space) ── */
  renderDamageNumbers(ctx, camera) {
    for (const d of this.damageNumbers) {
      const progress = d.life / d.maxLife;
      const alpha = Math.min(1, progress * 2);
      const screen = camera.worldToScreen(d.x, d.y);

      ctx.save();
      ctx.globalAlpha = alpha;

      const isCrit = d.type === 'crit';
      const isHeal = d.type === 'heal';
      const isText = d.type === 'text';

      const size = isCrit ? 22 : isHeal ? 16 : isText ? 13 : 15;
      ctx.font = `900 ${size}px 'Cinzel Decorative', serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = isCrit ? 12 : 6;

      if (isCrit) {
        ctx.font = `900 ${size}px 'Cinzel Decorative', serif`;
        ctx.fillText('CRIT!', screen.x, screen.y);
        ctx.font = `700 ${size - 4}px 'Cinzel Decorative', serif`;
        ctx.fillText(d.text, screen.x, screen.y + size);
      } else {
        ctx.fillText(d.text, screen.x, screen.y);
      }
      ctx.restore();
    }
  }

  /* ── HELPERS ── */
  _dirVec(facing) {
    switch (facing) {
      case 'up':    return [0, -1];
      case 'down':  return [0,  1];
      case 'left':  return [-1, 0];
      case 'right': return [1,  0];
      default:      return [0,  1];
    }
  }

  _angleDiff(a, b) {
    let diff = a - b;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  _rectsOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  /* Enemy fires a projectile toward player */
  enemyShoot(enemy, player, damage, color, speed = 5) {
    const dx = player.cx - enemy.cx;
    const dy = player.cy - enemy.cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    this.projectiles.push(new Projectile({
      x: enemy.cx, y: enemy.cy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage,
      width: 10, height: 10,
      color, glowColor: color,
      ownedByPlayer: false,
      life: 2000
    }));
  }

  reset() {
    this.projectiles = [];
    this.damageNumbers = [];
    this.cooldowns = {};
    this.activeEffects = [];
    this.marks = new Map();
  }
}

window.ABILITIES = ABILITIES;
window.CombatManager = CombatManager;
window.Projectile = Projectile;