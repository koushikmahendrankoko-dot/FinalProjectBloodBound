/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — enemy.js (v3 — Elden Ring edition)
   State-machine AI: patrol → detect → chase → attack → retreat
   Kiting for ranged types, boids separation, knockback,
   telegraph wind-up circles, achievement hooks.
═══════════════════════════════════════════════════════════════ */

let _enemyIdCounter = 0;

class Enemy {
  constructor(type, tx, ty) {
    this.id   = 'e' + (_enemyIdCounter++);
    this.type = type;

    const def = Sprites.ENEMY_SPRITES[type] || Sprites.ENEMY_SPRITES.grunt;
    this.maxHp     = def.maxHp;
    this.hp        = def.maxHp;
    this.speed     = def.speed;
    this.damage    = def.damage;
    this.xp        = def.xp;
    this.bloodDrop = def.bloodDrop;
    this.ranged    = !!def.ranged;
    this.kite      = !!def.kite;
    this.attackRange    = def.attackRange || 52;
    this.KITE_MIN_DIST  = this.ranged ? 130 : 0;
    this.KITE_MAX_DIST  = this.ranged ? 200 : 0;

    this.width  = 22;
    this.height = 22;
    this.x = tx * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.width)  / 2;
    this.y = ty * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.height) / 2;
    this.homeX = this.x;
    this.homeY = this.y;

    // Knockback
    this.knockVx = 0;
    this.knockVy = 0;

    // Patrol
    this.patrolRadius = 60;
    this.patrolTarget = this._randomPatrolPoint();
    this.patrolPauseTimer = 0;

    // State machine
    this.state   = 'patrol';
    this.facing  = 'down';
    this.flipX   = false;
    this.anim    = new Sprites.AnimationController(2, 250);
    this.isMoving= false;

    this.detectRange = 145;
    this.loseRange   = 230;

    // Attack
    this.attackCooldown    = 0;
    this.attackCooldownMax = this.ranged ? 1800 : 900;
    this.windupTimer       = 0;
    this.isWindingUp       = false;
    this.WINDUP_MS         = this.ranged ? 600 : 400;

    // Hurt / death
    this.hurtTimer    = 0;
    this.HURT_DURATION= 250;
    this.staggerTimer = 0;

    this.dead      = false;
    this.deathTimer= 0;
    this.lootGiven = false;

    // Separation force (boids)
    this.sepVx = 0;
    this.sepVy = 0;
  }

  get cx() { return this.x + this.width  / 2; }
  get cy() { return this.y + this.height / 2; }
  getBounds() { return { x:this.x+2, y:this.y+2, w:this.width-4, h:this.height-4 }; }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtTimer = this.HURT_DURATION;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathTimer = 0;
      if (window.Particles) Particles.enemyDeath(this.cx, this.cy, '#4a2020');
      // Achievement: first kill
      if (window.Achievements) {
        window.Achievements.unlock('first_kill');
        window.Achievements.increment('kills', [
          [50,  'kills_50'],
          [200, 'kills_200'],
          [500, 'kills_500'],
        ]);
      }
    } else {
      if (this.state !== 'attack') this.stagger(160);
    }
  }

  applyKnockback(vx, vy) {
    // Enemies resist knockback more than player
    this.knockVx += vx * 0.55;
    this.knockVy += vy * 0.55;
  }

  stagger(duration) {
    this.state = 'stagger';
    this.staggerTimer = duration;
  }

  update(dt, map, player, combat, allEnemies) {
    if (this.dead) { this.deathTimer += dt; return; }

    if (this.hurtTimer > 0)    this.hurtTimer    -= dt;
    if (this.attackCooldown>0) this.attackCooldown -= dt;

    // Knockback decay
    if (Math.abs(this.knockVx) > 0.1 || Math.abs(this.knockVy) > 0.1) {
      this._tryMove(this.knockVx, this.knockVy, map);
      this.knockVx *= 0.75;
      this.knockVy *= 0.75;
    }

    // Boids separation from other enemies
    this._computeSeparation(allEnemies);

    const dist = Math.hypot(player.cx - this.cx, player.cy - this.cy);

    switch(this.state) {
      case 'stagger':
        this.staggerTimer -= dt;
        this.isMoving = false;
        if (this.staggerTimer <= 0) this.state = 'patrol';
        break;

      case 'patrol':
        this._updatePatrol(dt, map);
        if (dist < this.detectRange && !player.dead) this.state = 'chase';
        break;

      case 'chase':
        if (player.dead || dist > this.loseRange) {
          this.state = 'patrol';
          this.patrolTarget = this._randomPatrolPoint();
          break;
        }
        if (this.kite) {
          this._updateKite(dt, map, player.cx, player.cy, dist);
        } else {
          if (dist < this.attackRange) this.state = 'attack';
          else this._moveToward(player.cx, player.cy, dt, map);
        }
        break;

      case 'attack':
        this.isMoving = false;
        if (player.dead || dist > this.attackRange * (this.ranged ? 1.5 : 1.4)) {
          this.state = 'chase';
          break;
        }
        this._updateFacing(player.cx, player.cy);
        if (!this.isWindingUp && this.attackCooldown <= 0) {
          this.isWindingUp = true;
          this.windupTimer = this.WINDUP_MS;
        }
        if (this.isWindingUp) {
          this.windupTimer -= dt;
          if (this.windupTimer <= 0) {
            this.isWindingUp = false;
            this._performAttack(player, combat);
            this.attackCooldown = this.attackCooldownMax;
          }
        }
        break;
    }

    // Apply separation
    if (this.state !== 'stagger') {
      this._tryMove(this.sepVx * 0.4, this.sepVy * 0.4, map);
    }

    this.anim.update(dt, this.isMoving);
  }

  _computeSeparation(allEnemies) {
    this.sepVx = 0; this.sepVy = 0;
    const SEP_RADIUS = 28;
    for (const other of allEnemies) {
      if (other === this || other.dead) continue;
      const dx = this.cx - other.cx, dy = this.cy - other.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < SEP_RADIUS) {
        const force = (SEP_RADIUS - dist) / SEP_RADIUS;
        this.sepVx += (dx / dist) * force;
        this.sepVy += (dy / dist) * force;
      }
    }
  }

  _updateKite(dt, map, tx, ty, dist) {
    if (dist < this.KITE_MIN_DIST) {
      // Too close — back away
      const dx = this.cx - tx, dy = this.cy - ty;
      const len = Math.hypot(dx,dy)||1;
      this._tryMove((dx/len)*this.speed*1.2, (dy/len)*this.speed*1.2, map);
      this.isMoving = true;
    } else if (dist > this.KITE_MAX_DIST) {
      // Too far — approach
      this._moveToward(tx, ty, dt, map);
    } else {
      // In sweet spot — strafe sideways
      const dx = this.cx - tx, dy = this.cy - ty;
      const perp = { x: -dy, y: dx };
      const len  = Math.hypot(perp.x, perp.y)||1;
      this._tryMove((perp.x/len)*this.speed*0.7, (perp.y/len)*this.speed*0.7, map);
      this.isMoving = true;
      // Attack when in range
      if (this.attackCooldown <= 0) this.state = 'attack';
    }
    this._updateFacing(tx, ty);
  }

  _updatePatrol(dt, map) {
    const dx   = this.patrolTarget.x - this.x;
    const dy   = this.patrolTarget.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      this.isMoving = false;
      this.patrolPauseTimer -= dt;
      if (this.patrolPauseTimer <= 0) {
        this.patrolTarget     = this._randomPatrolPoint();
        this.patrolPauseTimer = 1000 + Math.random()*2000;
      }
      return;
    }
    this.isMoving = true;
    const speed = this.speed * 0.4;
    this._tryMove((dx/dist)*speed, (dy/dist)*speed, map);
    this._updateFacing(this.patrolTarget.x, this.patrolTarget.y);
  }

  _moveToward(tx, ty, dt, map) {
    const dx = tx-this.x, dy = ty-this.y;
    const dist = Math.hypot(dx,dy);
    if (dist < 1) { this.isMoving=false; return; }
    this.isMoving = true;
    this._tryMove((dx/dist)*this.speed, (dy/dist)*this.speed, map);
    this._updateFacing(tx, ty);
  }

  _tryMove(mx, my, map) {
    const nx=this.x+mx, ny=this.y+my;
    if (!map.rectSolid(nx+2,this.y+2,this.width-4,this.height-4)) this.x=nx;
    if (!map.rectSolid(this.x+2,ny+2,this.width-4,this.height-4)) this.y=ny;
  }

  _updateFacing(tx, ty) {
    const dx=tx-this.cx, dy=ty-this.cy;
    if (Math.abs(dx)>Math.abs(dy)) { this.facing=dx>0?'right':'left'; this.flipX=dx<0; }
    else { this.facing=dy>0?'down':'up'; }
  }

  _performAttack(player, combat) {
    if (this.ranged) {
      const color = this.type==='mage'?'#c060ff':'#80c0ff';
      combat.enemyShoot(this, player, this.damage, color, 4.5);
    } else {
      const dist = Math.hypot(player.cx-this.cx, player.cy-this.cy);
      if (dist < this.attackRange) {
        // Check player parry first
        if (!combat.checkParry(player, this)) {
          player.takeDamage(this.damage, false, this.cx, this.cy);
          if (window.Particles) Particles.playerHurt(player.cx, player.cy);
        }
      }
    }
  }

  _randomPatrolPoint() {
    const angle = Math.random()*Math.PI*2;
    const r     = Math.random()*this.patrolRadius;
    return { x:this.homeX+Math.cos(angle)*r, y:this.homeY+Math.sin(angle)*r };
  }

  collectLoot() {
    if (this.lootGiven) return 0;
    this.lootGiven = true;
    const [min,max] = this.bloodDrop;
    return min + Math.floor(Math.random()*(max-min+1));
  }

  get readyToRemove() { return this.dead && this.deathTimer > 600; }

  render(ctx, camera) {
    if (!camera.isVisible(this.x,this.y,this.width,this.height)) return;
    if (this.dead && this.deathTimer > 500) return;
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0,1-this.deathTimer/500);
    if (this.hurtTimer>0 && Math.floor(this.hurtTimer/60)%2===0) ctx.filter='brightness(2.5) saturate(3)';
    const rs=this.width*1.8;
    Sprites.drawEnemySprite(ctx,this.type,this.anim.currentFrame,
      this.x-(rs-this.width)/2, this.y-(rs-this.height), rs, this.flipX);
    ctx.restore();

    // Wind-up telegraph ring
    if (this.isWindingUp) {
      const progress = 1 - this.windupTimer/this.WINDUP_MS;
      ctx.save();
      ctx.globalAlpha = 0.35+progress*0.35;
      ctx.strokeStyle = '#ff3347';
      ctx.lineWidth   = 2+progress*2;
      ctx.shadowColor = '#ff3347';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(this.cx,this.cy,14+progress*8,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderHpBar(ctx) {
    if (this.dead||this.hp>=this.maxHp) return;
    const bw=28,bh=3,bx=this.cx-bw/2,by=this.y-8;
    const pct=Math.max(0,this.hp/this.maxHp);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#cc1122'; ctx.fillRect(bx,by,Math.round(bw*pct),bh);
  }
}

/* ── ENEMY MANAGER ── */
class EnemyManager {
  constructor() { this.enemies = []; }

  spawnFromMapData(mapData) {
    this.enemies = (mapData.enemies||[]).map(e=>new Enemy(e.type,e.tx,e.ty));
  }

  update(dt, map, player, combat) {
    // Pass full enemy list for boids separation
    for (const e of this.enemies) e.update(dt,map,player,combat,this.enemies);
    let bloodEarned=0;
    this.enemies = this.enemies.filter(e=>{
      if (e.readyToRemove) { bloodEarned+=e.collectLoot(); return false; }
      return true;
    });
    return bloodEarned;
  }

  render(ctx,camera) {
    for (const e of this.enemies) { e.render(ctx,camera); e.renderHpBar(ctx); }
  }

  get aliveCount() { return this.enemies.filter(e=>!e.dead).length; }
  clear() { this.enemies=[]; }
}

window.Enemy       = Enemy;
window.EnemyManager= EnemyManager;
