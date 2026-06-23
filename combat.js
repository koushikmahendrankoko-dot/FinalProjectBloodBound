/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — combat.js (v3 — Elden Ring edition)
   Mouse-aimed attacks, parry detection, knockback scaling,
   all 7 blood abilities, hit-stop, blood decals on floor.
═══════════════════════════════════════════════════════════════ */

/* ── ABILITY DEFINITIONS ── */
const ABILITIES = {
  blood_surge: {
    name:'Blood Surge', icon:'⚡', hpCost:10, cooldown:1500,
    damage:2.5, range:65, type:'melee', effect:'single',
    description:'Powerful aimed strike. 2.5× damage toward cursor.'
  },
  crimson_whirl: {
    name:'Crimson Whirl', icon:'🌀', hpCost:15, cooldown:3000,
    damage:1.8, range:55, type:'melee', effect:'aoe360',
    description:'360° spin. Hits all nearby enemies.'
  },
  lifesteal: {
    name:'Lifesteal', icon:'🩸', hpCost:5, cooldown:2000,
    damage:1.2, range:60, type:'melee', effect:'lifesteal', healRatio:0.5,
    description:'Strike and absorb life. Heals 50% of damage dealt.'
  },
  hemorrhage: {
    name:'Hemorrhage', icon:'🔥', hpCost:20, cooldown:5000,
    damage:8, range:80, type:'aura', effect:'dot',
    duration:3000, tickRate:300,
    description:'Blood aura burns nearby enemies for 3s.'
  },
  death_mark: {
    name:'Death Mark', icon:'💀', hpCost:25, cooldown:8000,
    damage:0, range:100, type:'debuff', effect:'mark',
    markDuration:8000, damageMultiplier:2,
    description:'Brand an enemy — 2× damage for 8s.'
  },
  blood_tide: {
    name:'Blood Tide', icon:'🌊', hpCost:30, cooldown:10000,
    damage:5.0, range:9999, type:'projectile', effect:'wave',
    description:'Screen-wide blood wave. Pierces all enemies.'
  },
  sanguine_sacrifice: {
    name:'Sanguine Sacrifice', icon:'☠', hpCost:50, cooldown:15000,
    damage:150, range:9999, type:'aoe', effect:'sacrifice',
    description:'Sacrifice 50 HP. Deal 150 damage to ALL enemies.'
  }
};

/* ── BLOOD DECAL ── */
class BloodDecal {
  constructor(x, y) {
    this.x    = x + (Math.random()-0.5)*12;
    this.y    = y + (Math.random()-0.5)*8;
    this.r    = 4 + Math.random()*5;
    this.alpha= 0.55 + Math.random()*0.25;
    this.life = 18000 + Math.random()*12000; // 18-30s
  }
  update(dt) { this.life -= dt; if (this.life < 2000) this.alpha *= 0.995; }
  draw(ctx) {
    if (this.alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#4a0008';
    ctx.shadowColor= '#ff1122';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.r, this.r*0.55, Math.random()*0.4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

/* ── PROJECTILE ── */
class Projectile {
  constructor(opts) {
    this.x = opts.x; this.y = opts.y;
    this.vx = opts.vx??0; this.vy = opts.vy??0;
    this.damage = opts.damage??10;
    this.width  = opts.width??12; this.height = opts.height??12;
    this.color  = opts.color??'#ff3347'; this.glowColor = opts.glowColor??'#ff6070';
    this.ownedByPlayer = opts.ownedByPlayer??true;
    this.piercing = opts.piercing??false;
    this.hitEnemies = new Set();
    this.life   = opts.life??2000;
    this.dead   = false;
    this.shape  = opts.shape??'circle';
    this.isWave = opts.isWave??false;
    this.rotation = 0;
  }
  update(dt, map) {
    this.x += this.vx; this.y += this.vy;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (!this.isWave && map && map.isSolid(this.x, this.y)) this.dead = true;
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.shadowColor = this.glowColor; ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;
    if (this.isWave) {
      ctx.globalAlpha = Math.min(1, this.life/200);
      ctx.fillRect(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  getBounds() { return {x:this.x-this.width/2, y:this.y-this.height/2, w:this.width, h:this.height}; }
}

/* ── COMBAT MANAGER ── */
class CombatManager {
  constructor() {
    this.projectiles   = [];
    this.damageNumbers = [];
    this.cooldowns     = {};
    this.activeEffects = [];
    this.marks         = new Map();
    this.bloodDecals   = [];  // persistent floor stains
  }

  /* ── COOLDOWNS ── */
  startCooldown(key) {
    const a = ABILITIES[key]; if (!a) return;
    this.cooldowns[key] = a.cooldown;
  }
  updateCooldowns(dt) { for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k]-dt); }
  isReady(key)  { return !this.cooldowns[key] || this.cooldowns[key] <= 0; }
  getCooldownProgress(key) {
    const a = ABILITIES[key]; if (!a || this.isReady(key)) return 1;
    return 1 - this.cooldowns[key]/a.cooldown;
  }

  /* ── BASIC ATTACK (mouse-aimed) ──
     Fires in the direction of player.aimAngle with a generous arc. */
  basicAttack(player, enemies, camera) {
    const REACH   = 62;
    const HALF_ARC= 55 * Math.PI/180; // degrees each side
    const aimAngle= player.aimAngle;
    let hit = false;

    for (const e of enemies) {
      if (e.dead) continue;
      const dx   = e.cx - player.cx;
      const dy   = e.cy - player.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > REACH) continue;
      const angle = Math.atan2(dy, dx);
      const diff  = Math.abs(this._angleDiff(angle, aimAngle));
      if (diff > HALF_ARC) continue;

      const dmg = this._applyMark(e.id, player.baseAttack);
      this.dealDamage(e, dmg, '#ffe070', 'normal', player.cx, player.cy);
      if (window.Particles) {
        Particles.hitSpark(e.cx, e.cy);
        Particles.bloodSplatter(e.cx, e.cy, 0.8);
      }
      this._addDecal(e.cx, e.cy);

      // Knockback enemy away from player
      if (e.applyKnockback) {
        const len = dist||1;
        e.applyKnockback((dx/len)*3, (dy/len)*3);
      }
      hit = true;
    }

    if (hit && camera) {
      camera.hitStop(40);
      camera.shake(3, 110, 'normal');
    }
    return hit;
  }

  /* ── USE ABILITY ── */
  useAbility(abilityKey, player, enemies, camera, saveData) {
    const ability = ABILITIES[abilityKey];
    if (!ability || !this.isReady(abilityKey)) return false;

    let cost = ability.hpCost;
    if (saveData?.relics?.includes('vial_of_ancients')) cost = Math.max(1, cost-2);
    if (player.hp <= cost) {
      this.showDamageNumber(player.cx, player.cy-30, 'Not enough HP!', '#ff6070', 'text');
      return false;
    }

    player.hp -= cost;
    if (saveData?.stats) saveData.stats.hpSacrificed = (saveData.stats.hpSacrificed||0)+cost;

    const crimsonCrown = saveData?.relics?.includes('crimson_crown') && player.hp/player.maxHp < 0.25;
    const damageMult   = crimsonCrown ? 1.5 : 1;

    switch (ability.effect) {
      case 'single':
        this._castSingle(ability, player, enemies, camera, damageMult);
        if (window.Particles) Particles.bloodSurge(player.cx, player.cy, Math.cos(player.aimAngle), Math.sin(player.aimAngle));
        break;
      case 'aoe360':
        this._castAoe360(ability, player, enemies, camera, damageMult);
        if (window.Particles) Particles.crimsonWhirl(player.cx, player.cy);
        if (camera) camera.shake(5, 200, 'normal');
        break;
      case 'lifesteal':
        const healed = this._castLifesteal(ability, player, enemies, camera, damageMult);
        if (healed > 0) this.showDamageNumber(player.cx, player.cy-30, `+${healed}`, '#2ecc71', 'heal');
        break;
      case 'dot':
        this._castDot(ability, player, damageMult);
        break;
      case 'mark':
        this._castMark(ability, player, enemies);
        if (window.Particles) Particles.deathMark(player.cx, player.cy);
        break;
      case 'wave':
        this._castWave(ability, player, damageMult);
        if (window.Particles) Particles.bloodTide(player.cx, player.cy, 2000);
        if (camera) { camera.hitStop(80); camera.shake(8, 400, 'heavy'); }
        break;
      case 'sacrifice':
        this._castSacrifice(ability, player, enemies, camera, damageMult);
        if (window.Particles) Particles.sanguineSacrifice(player.cx, player.cy);
        if (camera) { camera.hitStop(140); camera.shake(14, 600, 'crit'); }
        break;
    }

    this.startCooldown(abilityKey);
    return true;
  }

  _castSingle(ability, player, enemies, camera, mult) {
    const aimAngle = player.aimAngle;
    let hit = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.cx-player.cx, dy = e.cy-player.cy;
      const dist = Math.hypot(dx,dy);
      if (dist > ability.range) continue;
      const angle = Math.atan2(dy,dx);
      if (Math.abs(this._angleDiff(angle,aimAngle)) > 70*Math.PI/180) continue;
      const dmg = Math.round(player.baseAttack*ability.damage*mult);
      const fd  = this._applyMark(e.id, dmg);
      this.dealDamage(e, fd, '#ff6070', 'blood', player.cx, player.cy);
      if (window.Particles) Particles.bloodSplatter(e.cx, e.cy, 1.5);
      this._addDecal(e.cx, e.cy);
      if (e.applyKnockback) { const l=dist||1; e.applyKnockback((dx/l)*5,(dy/l)*5); }
      hit = true;
    }
    if (hit && camera) { camera.hitStop(60); camera.shake(5, 180, 'normal'); }
  }

  _castAoe360(ability, player, enemies, camera, mult) {
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.cx-player.cx, e.cy-player.cy);
      if (dist > ability.range) continue;
      const dmg = Math.round(player.baseAttack*ability.damage*mult);
      const fd  = this._applyMark(e.id, dmg);
      this.dealDamage(e, fd, '#ff3347', 'blood', player.cx, player.cy);
      if (e.stagger) e.stagger(300);
      if (window.Particles) Particles.bloodSplatter(e.cx, e.cy, 1);
      this._addDecal(e.cx, e.cy);
    }
  }

  _castLifesteal(ability, player, enemies, camera, mult) {
    let totalHeal = 0;
    const aimAngle = player.aimAngle;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.cx-player.cx, dy = e.cy-player.cy;
      const dist = Math.hypot(dx,dy);
      if (dist > ability.range) continue;
      const angle = Math.atan2(dy,dx);
      if (Math.abs(this._angleDiff(angle,aimAngle)) > 80*Math.PI/180) continue;
      const dmg = Math.round(player.baseAttack*ability.damage*mult);
      const fd  = this._applyMark(e.id, dmg);
      this.dealDamage(e, fd, '#cc00aa', 'blood', player.cx, player.cy);
      totalHeal += Math.round(fd*ability.healRatio);
      if (window.Particles) Particles.hitSpark(e.cx, e.cy);
    }
    if (totalHeal > 0) player.hp = Math.min(player.maxHp, player.hp+totalHeal);
    return totalHeal;
  }

  _castDot(ability, player, mult) {
    this.activeEffects.push({
      type:'hemorrhage', x:player.cx, y:player.cy,
      radius:ability.range, damage:ability.damage*mult,
      life:ability.duration, tickTimer:0, tickRate:ability.tickRate, ownerId:'player'
    });
  }

  _castMark(ability, player, enemies) {
    let closest=null, closestDist=Infinity;
    // Prefer enemy nearest mouse cursor direction
    const aimAngle = player.aimAngle;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx=e.cx-player.cx, dy=e.cy-player.cy;
      const dist=Math.hypot(dx,dy);
      if (dist<ability.range && dist<closestDist) { closest=e; closestDist=dist; }
    }
    if (closest) {
      this.marks.set(closest.id, {multiplier:ability.damageMultiplier, life:ability.markDuration});
      if (window.Particles) Particles.deathMark(closest.cx, closest.cy);
    }
  }

  _castWave(ability, player, mult) {
    const vx = Math.cos(player.aimAngle)*12;
    const vy = Math.sin(player.aimAngle)*12;
    this.projectiles.push(new Projectile({
      x:player.cx, y:player.cy, vx, vy,
      damage:Math.round(player.baseAttack*ability.damage*mult),
      width:24, height:120, color:'#cc0020', glowColor:'#ff3347',
      ownedByPlayer:true, piercing:true, isWave:true, life:1500
    }));
  }

  _castSacrifice(ability, player, enemies, camera, mult) {
    const dmg = Math.round(ability.damage*mult);
    for (const e of enemies) {
      if (e.dead) continue;
      const fd = this._applyMark(e.id, dmg);
      this.dealDamage(e, fd, '#ff9900', 'crit', player.cx, player.cy);
      if (window.Particles) Particles.bloodSplatter(e.cx, e.cy, 2.5);
      this._addDecal(e.cx, e.cy);
    }
    if (window.Particles) Particles.critImpact(player.cx, player.cy);
  }

  /* ── DEAL DAMAGE ── */
  dealDamage(entity, amount, color='#ff6070', type='normal', srcX=null, srcY=null) {
    if (!entity||entity.dead) return;
    if (srcX!==null && entity.applyKnockback) {
      // knockback applied by individual cast methods
    }
    entity.takeDamage(amount);
    this.showDamageNumber(
      entity.cx+(Math.random()-0.5)*20,
      entity.cy-20, amount.toString(), color, type
    );
  }

  /* ── PARRY CHECK (called when enemy tries to hit player) ──
     Returns true if parry absorbed the hit. */
  checkParry(player, attacker) {
    if (!player.parryWindow) return false;
    return player.resolveParry(attacker);
  }

  /* ── BLOOD DECALS ── */
  _addDecal(x, y) {
    if (this.bloodDecals.length < 120) {
      this.bloodDecals.push(new BloodDecal(x, y));
    }
  }

  renderDecals(ctx) {
    for (const d of this.bloodDecals) d.draw(ctx);
  }

  /* ── DAMAGE NUMBERS ── */
  showDamageNumber(x, y, text, color, type='normal') {
    this.damageNumbers.push({
      x, y, text, color, type,
      life:900, maxLife:900,
      vy:-1.6-Math.random()*0.5,
      vx:(Math.random()-0.5)*0.8,
      scale: type==='crit'?1.5:1
    });
  }

  /* ── UPDATE ── */
  update(dt, map, player, enemies) {
    this.updateCooldowns(dt);

    // Projectiles
    for (let i=this.projectiles.length-1; i>=0; i--) {
      const p = this.projectiles[i];
      p.update(dt, map);
      if (!p.dead) {
        if (p.ownedByPlayer) {
          for (const e of enemies) {
            if (e.dead || p.hitEnemies.has(e.id)) continue;
            const b=p.getBounds(), eb=e.getBounds();
            if (this._rectsOverlap(b,eb)) {
              const fd = this._applyMark(e.id, p.damage);
              this.dealDamage(e, fd, '#ff3347', 'blood', p.x, p.y);
              if (window.Particles) Particles.bloodSplatter(e.cx, e.cy, 1);
              this._addDecal(e.cx, e.cy);
              if (p.piercing) p.hitEnemies.add(e.id);
              else { p.dead=true; break; }
            }
          }
        } else {
          if (player && !player.invincible) {
            const b=p.getBounds(), pb=player.getBounds();
            if (this._rectsOverlap(b,pb)) {
              // Parry check first
              if (!this.checkParry(player, null)) {
                player.takeDamage(p.damage, false, p.x, p.y);
                if (window.Particles) Particles.playerHurt(player.cx, player.cy);
              }
              p.dead=true;
            }
          }
        }
      }
      if (p.dead) this.projectiles.splice(i,1);
    }

    // DoT / Aura effects
    for (let i=this.activeEffects.length-1; i>=0; i--) {
      const eff = this.activeEffects[i];
      eff.life -= dt; eff.tickTimer -= dt;
      if (eff.type==='hemorrhage' && eff.tickTimer<=0) {
        eff.tickTimer = eff.tickRate;
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.cx-eff.x, e.cy-eff.y)<=eff.radius) {
            this.dealDamage(e, eff.damage, '#ff8030', 'normal');
          }
        }
        if (window.Particles) Particles.hemorrhage(eff.x, eff.y);
      }
      if (eff.life<=0) this.activeEffects.splice(i,1);
    }

    // Death marks
    for (const [id,mark] of this.marks) { mark.life-=dt; if(mark.life<=0) this.marks.delete(id); }

    // Damage numbers
    for (let i=this.damageNumbers.length-1; i>=0; i--) {
      const d=this.damageNumbers[i];
      d.x+=d.vx; d.y+=d.vy; d.life-=dt;
      if (d.life<=0) this.damageNumbers.splice(i,1);
    }

    // Blood decals
    for (let i=this.bloodDecals.length-1; i>=0; i--) {
      this.bloodDecals[i].update(dt);
      if (this.bloodDecals[i].dead) this.bloodDecals.splice(i,1);
    }
  }

  /* ── RENDER PROJECTILES ── */
  renderProjectiles(ctx) { for (const p of this.projectiles) p.draw(ctx); }

  /* ── RENDER DAMAGE NUMBERS (screen-space) ── */
  renderDamageNumbers(ctx, camera) {
    for (const d of this.damageNumbers) {
      const progress = d.life/d.maxLife;
      const alpha    = Math.min(1, progress*2);
      const screen   = camera.worldToScreen(d.x, d.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      const isCrit  = d.type==='crit';
      const isHeal  = d.type==='heal';
      const isText  = d.type==='text';
      const size    = isCrit?22:isHeal?16:isText?13:15;
      ctx.font      = `900 ${size}px 'Cinzel Decorative', serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = d.color;
      ctx.shadowColor= d.color;
      ctx.shadowBlur = isCrit?14:6;
      if (isCrit) {
        ctx.fillText('CRIT!', screen.x, screen.y);
        ctx.font = `700 ${size-4}px 'Cinzel Decorative', serif`;
        ctx.fillText(d.text, screen.x, screen.y+size);
      } else {
        ctx.fillText(d.text, screen.x, screen.y);
      }
      ctx.restore();
    }
  }

  /* ── HELPERS ── */
  _applyMark(id, baseDmg) {
    const mark = this.marks.get(id);
    return mark ? Math.round(baseDmg*mark.multiplier) : baseDmg;
  }
  _dirVec(facing) {
    return {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[facing]||[0,1];
  }
  _angleDiff(a,b) {
    let d=a-b;
    while(d> Math.PI) d-=Math.PI*2;
    while(d<-Math.PI) d+=Math.PI*2;
    return d;
  }
  _rectsOverlap(a,b) {
    return !(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y);
  }
  enemyShoot(enemy, player, damage, color, speed=5) {
    const dx=player.cx-enemy.cx, dy=player.cy-enemy.cy;
    const dist=Math.hypot(dx,dy)||1;
    this.projectiles.push(new Projectile({
      x:enemy.cx, y:enemy.cy,
      vx:(dx/dist)*speed, vy:(dy/dist)*speed,
      damage, width:10, height:10, color, glowColor:color,
      ownedByPlayer:false, life:2000
    }));
  }
  reset() {
    this.projectiles=[]; this.damageNumbers=[]; this.cooldowns={};
    this.activeEffects=[]; this.marks=new Map();
    // keep bloodDecals — they persist between rooms intentionally
  }
}

window.ABILITIES   = ABILITIES;
window.CombatManager = CombatManager;
window.Projectile  = Projectile;