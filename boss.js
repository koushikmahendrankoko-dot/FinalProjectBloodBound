/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — boss.js (v3 — Elden Ring edition)
   Multi-phase bosses, telegraphed wind-ups, hit-stop on heavy
   attacks, knockback, phase-transition cinematics, arena
   atmospheric effects, achievement hooks. All 5 bosses.
═══════════════════════════════════════════════════════════════ */

const BOSS_DEFS = {
  village_guardian: {
    name:'The Village Guardian', maxHp:220, speed:1.3, size:48,
    phases:[
      {threshold:1.0, pattern:'sweep',   cooldown:2200},
      {threshold:0.5, pattern:'pillars', cooldown:1800}
    ]
  },
  hollow_beast: {
    name:'The Hollow Beast', maxHp:340, speed:1.6, size:54,
    phases:[
      {threshold:1.0,  pattern:'emerge',  cooldown:2000},
      {threshold:0.6,  pattern:'charge',  cooldown:1600},
      {threshold:0.25, pattern:'berserk', cooldown:1000}
    ]
  },
  lord_vael: {
    name:'Lord Vael', maxHp:400, speed:1.9, size:44,
    phases:[
      {threshold:1.0,  pattern:'sword',       cooldown:1800},
      {threshold:0.65, pattern:'summon',      cooldown:2400},
      {threshold:0.3,  pattern:'rune_reveal', cooldown:1400}
    ]
  },
  blood_guardians: {
    name:'The Four Guardians', maxHp:480, speed:1.2, size:46,
    phases:[
      {threshold:1.0,  pattern:'flame',  cooldown:2000},
      {threshold:0.75, pattern:'stone',  cooldown:1800},
      {threshold:0.5,  pattern:'shadow', cooldown:1600},
      {threshold:0.25, pattern:'blood',  cooldown:1400}
    ]
  },
  blood_god: {
    name:'The Blood God', maxHp:650, speed:1.7, size:60,
    phases:[
      {threshold:1.0,  pattern:'orbs',        cooldown:1800},
      {threshold:0.8,  pattern:'fracture',    cooldown:1600},
      {threshold:0.55, pattern:'absorb',      cooldown:2000},
      {threshold:0.3,  pattern:'desperation', cooldown:1200},
      {threshold:0.1,  pattern:'final',       cooldown:1000}
    ]
  }
};

/* Global stagger token — prevents all enemies attacking at once */
let _globalAttackToken = 0;

class Boss {
  constructor(type, tx, ty) {
    this.type = type;
    this.def  = BOSS_DEFS[type] || BOSS_DEFS.village_guardian;
    this.name = this.def.name;

    this.maxHp = this.def.maxHp;
    this.hp    = this.def.maxHp;
    this.speed = this.def.speed;

    this.width  = this.def.size;
    this.height = this.def.size;
    this.x = tx * Sprites.TILE_SIZE - this.width  / 2;
    this.y = ty * Sprites.TILE_SIZE - this.height / 2;

    this.currentPhaseIndex = 0;
    this.phase = this.def.phases[0].pattern;
    this.attackCooldown = this.def.phases[0].cooldown;
    this.attackTimer    = this.attackCooldown;

    // Wind-up state machine
    this.isWindingUp    = false;
    this.windupTimer    = 0;
    this.currentAttack  = null;

    // Phase transition
    this.phaseTransitioning    = false;
    this.phaseTransitionTimer  = 0;
    this.PHASE_TRANSITION_MS   = 1200;

    // Intro
    this.state      = 'intro';
    this.introTimer = 1800;

    // Hurt / knockback
    this.hurtTimer  = 0;
    this.knockVx    = 0;
    this.knockVy    = 0;

    // Death
    this.dead       = false;
    this.deathTimer = 0;

    // Arena ambient particles timer
    this.ambientTimer = 0;
  }

  get cx() { return this.x + this.width  / 2; }
  get cy() { return this.y + this.height / 2; }
  get hpPct() { return this.hp / this.maxHp; }

  getBounds() { return { x:this.x+6, y:this.y+6, w:this.width-12, h:this.height-12 }; }

  takeDamage(amount) {
    if (this.dead || this.state==='intro') return;
    this.hp -= amount;
    this.hurtTimer = 200;

    if (this.hp <= 0) {
      this.hp   = 0;
      this.dead = true;
      if (window.Particles) Particles.bossPhaseTransition(this.cx, this.cy);
      if (window.__activeCamera) {
        window.__activeCamera.hitStop(200);
        window.__activeCamera.shake(18, 800, 'crit');
      }
      // Achievement
      if (window.Achievements) {
        window.Achievements.unlock('first_kill');
        window.Achievements.increment('kills',[[1,'first_kill']]);
        // No-damage boss achievement checked in main.js
      }
      return;
    }

    // Phase check
    const nextIdx = this.currentPhaseIndex + 1;
    if (nextIdx < this.def.phases.length &&
        this.hpPct <= this.def.phases[nextIdx].threshold) {
      this._transitionPhase(nextIdx);
    }
  }

  applyKnockback(vx, vy) {
    // Bosses resist knockback heavily
    this.knockVx += vx * 0.18;
    this.knockVy += vy * 0.18;
  }

  _transitionPhase(idx) {
    this.currentPhaseIndex      = idx;
    this.phase                  = this.def.phases[idx].pattern;
    this.attackCooldown         = this.def.phases[idx].cooldown;
    this.phaseTransitioning     = true;
    this.phaseTransitionTimer   = this.PHASE_TRANSITION_MS;
    if (window.Particles) Particles.bossPhaseTransition(this.cx, this.cy);
    if (window.__activeCamera) {
      window.__activeCamera.hitStop(300);
      window.__activeCamera.shake(14, 600, 'heavy');
    }
    if (window.AudioManager) window.__audio?.playSfx('boss_phase');
  }

  update(dt, player, map, combat, enemyManager) {
    if (this.dead) { this.deathTimer += dt; return; }

    // Ambient arena particles
    this.ambientTimer += dt;
    if (this.ambientTimer > 400) {
      this.ambientTimer = 0;
      if (window.Particles) {
        Particles.torchFlicker(this.cx + (Math.random()-0.5)*80, this.cy + (Math.random()-0.5)*80);
      }
    }

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.state = 'active';
      return;
    }

    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // Knockback decay
    if (Math.abs(this.knockVx)>0.1||Math.abs(this.knockVy)>0.1) {
      this.x += this.knockVx; this.y += this.knockVy;
      this.knockVx *= 0.8; this.knockVy *= 0.8;
    }

    if (this.phaseTransitioning) {
      this.phaseTransitionTimer -= dt;
      if (this.phaseTransitionTimer <= 0) this.phaseTransitioning = false;
      return;
    }

    this._updateFacing(player.cx, player.cy);
    this._runPattern(dt, player, combat, enemyManager, map);
  }

  _updateFacing(tx, ty) {
    const dx=tx-this.cx, dy=ty-this.cy;
    if (Math.abs(dx)>Math.abs(dy)) this.facing=dx>0?'right':'left';
    else this.facing=dy>0?'down':'up';
  }

  _runPattern(dt, player, combat, enemyManager, map) {
    this.attackTimer -= dt;

    // Move toward player if not winding up
    if (!this.isWindingUp) {
      const dist=Math.hypot(player.cx-this.cx, player.cy-this.cy);
      if (dist > 80) {
        const dx=(player.cx-this.cx)/dist, dy=(player.cy-this.cy)/dist;
        this.x += dx*this.speed; this.y += dy*this.speed;
      }
    }

    if (this.attackTimer <= 0 && !this.isWindingUp) {
      this._beginWindup();
    }

    if (this.isWindingUp) {
      this.windupTimer -= dt;
      if (this.windupTimer <= 0) {
        this._executeAttack(player, combat, enemyManager);
        this.isWindingUp  = false;
        this.attackTimer  = this.attackCooldown;
      }
    }
  }

  _beginWindup() {
    this.isWindingUp = true;
    const windups = {
      sweep:       700,  pillars:    900,  emerge:     600,
      charge:      500,  berserk:    300,  sword:      500,
      summon:      900,  rune_reveal:700,  flame:      700,
      stone:       600,  shadow:     500,  blood:      1000,
      orbs:        700,  fracture:   600,  absorb:     1100,
      desperation: 350,  final:      1300
    };
    this.windupTimer  = windups[this.phase] || 600;
    this.currentAttack= this.phase;
  }

  _executeAttack(player, combat, enemyManager) {
    const dist = Math.hypot(player.cx-this.cx, player.cy-this.cy);
    const cam  = window.__activeCamera;

    switch(this.currentAttack) {
      case 'sweep':
      case 'emerge':
      case 'sword':
        if (dist < this.width*1.3) {
          if (!combat.checkParry(player, this)) {
            player.takeDamage(16, false, this.cx, this.cy);
          }
        }
        if (cam) { cam.hitStop(80); cam.shake(6,220,'normal'); }
        if (window.Particles) Particles.bloodSplatter(this.cx,this.cy,1.2);
        break;

      case 'pillars':
      case 'flame':
        for (let i=0;i<4;i++) {
          const px=player.cx+(Math.random()-0.5)*220;
          const py=player.cy+(Math.random()-0.5)*220;
          combat.activeEffects.push({
            type:'hemorrhage',x:px,y:py,radius:44,
            damage:10,life:700,tickTimer:0,tickRate:280,ownerId:'boss'
          });
          if (window.Particles) Particles.hemorrhage(px,py);
        }
        if (cam) cam.shake(5,300,'normal');
        break;

      case 'charge':
      case 'stone': {
        const dx=player.cx-this.cx, dy=player.cy-this.cy;
        const d=Math.hypot(dx,dy)||1;
        this.x+=(dx/d)*70; this.y+=(dy/d)*70;
        if (dist<this.width*1.5) {
          if (!combat.checkParry(player,this)) {
            player.takeDamage(22, false, this.cx, this.cy);
          }
        }
        if (cam) { cam.hitStop(100); cam.shake(8,280,'heavy'); }
        break;
      }

      case 'berserk':
      case 'desperation':
        if (dist<this.width*1.1) {
          if (!combat.checkParry(player,this)) {
            player.takeDamage(12, false, this.cx, this.cy);
          }
        }
        this.attackCooldown = Math.max(600, this.attackCooldown-100);
        break;

      case 'summon':
        if (enemyManager) {
          const tx=Math.floor(this.cx/Sprites.TILE_SIZE);
          const ty=Math.floor(this.cy/Sprites.TILE_SIZE);
          enemyManager.enemies.push(new Enemy('grunt',tx-2,ty));
          enemyManager.enemies.push(new Enemy('grunt',tx+2,ty));
          enemyManager.enemies.push(new Enemy('archer',tx,ty-2));
        }
        if (window.Particles) Particles.bossPhaseTransition(this.cx,this.cy);
        break;

      case 'rune_reveal':
      case 'blood':
        combat.activeEffects.push({
          type:'hemorrhage',x:this.cx,y:this.cy,radius:100,
          damage:8,life:2000,tickTimer:0,tickRate:300,ownerId:'boss'
        });
        if (window.Particles) Particles.deathMark(this.cx,this.cy);
        if (cam) cam.shake(6,400,'normal');
        break;

      case 'shadow':
        combat.projectiles.push(new Projectile({
          x:this.cx,y:this.cy,
          vx:(player.cx>this.cx?1:-1)*5, vy:0,
          damage:18,width:20,height:90,
          color:'#330010',glowColor:'#ff1133',
          ownedByPlayer:false,piercing:true,isWave:true,life:1400
        }));
        break;

      case 'orbs':
        for (let i=0;i<6;i++) {
          const angle=(i/6)*Math.PI*2;
          combat.projectiles.push(new Projectile({
            x:this.cx,y:this.cy,
            vx:Math.cos(angle)*4.5, vy:Math.sin(angle)*4.5,
            damage:14,width:14,height:14,
            color:'#ff3347',glowColor:'#ff6070',
            ownedByPlayer:false,life:2800
          }));
        }
        if (cam) cam.shake(5,200,'normal');
        break;

      case 'fracture': {
        // 3 targeted blood bolts
        const dx=player.cx-this.cx, dy=player.cy-this.cy;
        const d=Math.hypot(dx,dy)||1;
        [-0.3,0,0.3].forEach(offset=>{
          const a=Math.atan2(dy,dx)+offset;
          combat.projectiles.push(new Projectile({
            x:this.cx,y:this.cy,
            vx:Math.cos(a)*6,vy:Math.sin(a)*6,
            damage:16,width:12,height:12,
            color:'#cc0020',glowColor:'#ff3347',
            ownedByPlayer:false,life:2200
          }));
        });
        break;
      }

      case 'absorb': {
        const drain=Math.min(18,player.hp-1);
        if (drain>0) {
          player.takeDamage(drain, true);
          this.hp=Math.min(this.maxHp,this.hp+drain*2);
          if (window.Particles) Particles.deathMark(player.cx,player.cy);
        }
        if (cam) { cam.hitStop(120); cam.shake(10,400,'heavy'); }
        break;
      }

      case 'final':
        for (let i=0;i<14;i++) {
          const angle=(i/14)*Math.PI*2;
          combat.projectiles.push(new Projectile({
            x:this.cx,y:this.cy,
            vx:Math.cos(angle)*5.5, vy:Math.sin(angle)*5.5,
            damage:20,width:16,height:16,
            color:'#ff6600',glowColor:'#ff3347',
            ownedByPlayer:false,life:3000
          }));
        }
        if (window.Particles) Particles.bossPhaseTransition(this.cx,this.cy);
        if (cam) { cam.hitStop(200); cam.shake(18,800,'crit'); }
        if (window.Achievements) window.Achievements.unlock('no_damage_boss');
        break;
    }
  }

  render(ctx, camera) {
    if (this.dead && this.deathTimer > 900) return;
    ctx.save();
    if (this.dead) ctx.globalAlpha=Math.max(0,1-this.deathTimer/900);
    if (this.state==='intro') ctx.globalAlpha=Math.min(1,1-this.introTimer/1800);
    if (this.hurtTimer>0 && Math.floor(this.hurtTimer/50)%2===0) {
      ctx.filter='brightness(2) saturate(2)';
    }
    Sprites.drawBossSprite(ctx, this.type, this.x, this.y, this.width, this.isWindingUp);
    ctx.restore();

    // Wind-up ring
    if (this.isWindingUp) {
      const progress=1-this.windupTimer/(this.def.phases[this.currentPhaseIndex].cooldown||700);
      ctx.save();
      ctx.globalAlpha=0.5+progress*0.3;
      ctx.strokeStyle='rgba(255,51,71,.8)';
      ctx.lineWidth=3+progress*3;
      ctx.shadowColor='#ff3347'; ctx.shadowBlur=14;
      ctx.beginPath();
      ctx.arc(this.cx,this.cy,this.width*0.95+progress*10,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // Phase transition flash overlay
    if (this.phaseTransitioning) {
      const progress=1-this.phaseTransitionTimer/this.PHASE_TRANSITION_MS;
      ctx.save();
      ctx.globalAlpha=(1-progress)*0.5;
      ctx.fillStyle='#ff3347';
      ctx.fillRect(this.x-20,this.y-20,this.width+40,this.height+40);
      ctx.restore();
    }
  }

  renderBossBar(ctx, canvasWidth) {
    // Rendered by ui.js updateBossHp — this is a canvas fallback
  }
}

window.BOSS_DEFS = BOSS_DEFS;
window.Boss      = Boss;