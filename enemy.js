/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — enemy.js
   Enemy entities: state-machine AI (patrol → detect → chase →
   attack → retreat), melee + ranged types, death/loot drops
═══════════════════════════════════════════════════════════════ */

let _enemyIdCounter = 0;

class Enemy {
  constructor(type, tx, ty) {
    this.id = 'e' + (_enemyIdCounter++);
    this.type = type;

    const def = Sprites.ENEMY_SPRITES[type] || Sprites.ENEMY_SPRITES.grunt;
    this.maxHp = def.maxHp;
    this.hp = def.maxHp;
    this.speed = def.speed;
    this.damage = def.damage;
    this.xp = def.xp;
    this.bloodDrop = def.bloodDrop;
    this.ranged = !!def.ranged;
    this.attackRange = def.attackRange || 50;
    this.color = '#4a2020';

    this.width = 22;
    this.height = 22;

    this.x = tx * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.width) / 2;
    this.y = ty * Sprites.TILE_SIZE + (Sprites.TILE_SIZE - this.height) / 2;

    this.homeX = this.x;
    this.homeY = this.y;
    this.patrolRadius = 60;
    this.patrolTarget = this._randomPatrolPoint();

    this.state = 'patrol'; // patrol | chase | attack | stagger | dead
    this.facing = 'down';
    this.flipX = false;

    this.anim = new Sprites.AnimationController(2, 250);
    this.isMoving = false;

    this.detectRange = 140;
    this.loseRange = 220;
    this.attackCooldown = 0;
    this.attackCooldownMax = this.ranged ? 1800 : 900;

    this.staggerTimer = 0;
    this.hurtTimer = 0;
    this.HURT_DURATION = 250;

    this.dead = false;
    this.deathTimer = 0;
    this.lootGiven = false;

    this.patrolPauseTimer = 0;
  }

  get cx() { return this.x + this.width / 2; }
  get cy() { return this.y + this.height / 2; }

  getBounds() {
    return { x: this.x + 2, y: this.y + 2, w: this.width - 4, h: this.height - 4 };
  }

  _randomPatrolPoint() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * this.patrolRadius;
    return {
      x: this.homeX + Math.cos(angle) * r,
      y: this.homeY + Math.sin(angle) * r
    };
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtTimer = this.HURT_DURATION;

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathTimer = 0;
      Particles.enemyDeath(this.cx, this.cy, this.color);
    } else {
      if (this.state !== 'attack') this.stagger(150);
    }
  }

  stagger(duration) {
    this.state = 'stagger';
    this.staggerTimer = duration;
  }

  update(dt, map, player, combat) {
    if (this.dead) {
      this.deathTimer += dt;
      return;
    }

    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const distToPlayer = Math.hypot(player.cx - this.cx, player.cy - this.cy);

    switch (this.state) {
      case 'stagger':
        this.staggerTimer -= dt;
        this.isMoving = false;
        if (this.staggerTimer <= 0) this.state = 'patrol';
        break;

      case 'patrol':
        this._updatePatrol(dt, map);
        if (distToPlayer < this.detectRange && !player.dead) {
          this.state = 'chase';
        }
        break;

      case 'chase':
        if (player.dead || distToPlayer > this.loseRange) {
          this.state = 'patrol';
          this.patrolTarget = this._randomPatrolPoint();
          break;
        }
        if (distToPlayer < this.attackRange) {
          this.state = 'attack';
        } else {
          this._moveToward(player.cx, player.cy, dt, map);
        }
        break;

      case 'attack':
        this.isMoving = false;
        if (player.dead || distToPlayer > this.attackRange * 1.3) {
          this.state = 'chase';
          break;
        }
        this._updateFacing(player.cx, player.cy);
        if (this.attackCooldown <= 0) {
          this._performAttack(player, combat);
          this.attackCooldown = this.attackCooldownMax;
        }
        break;
    }

    this.anim.update(dt, this.isMoving);
  }

  _updatePatrol(dt, map) {
    const dx = this.patrolTarget.x - this.x;
    const dy = this.patrolTarget.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) {
      this.isMoving = false;
      this.patrolPauseTimer -= dt;
      if (this.patrolPauseTimer <= 0) {
        this.patrolTarget = this._randomPatrolPoint();
        this.patrolPauseTimer = 1000 + Math.random() * 2000;
      }
      return;
    }

    this.isMoving = true;
    const speed = this.speed * 0.4;
    const moveX = (dx / dist) * speed;
    const moveY = (dy / dist) * speed;
    this._tryMove(moveX, moveY, map);
    this._updateFacing(this.patrolTarget.x, this.patrolTarget.y);
  }

  _moveToward(targetX, targetY, dt, map) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) { this.isMoving = false; return; }

    this.isMoving = true;
    const moveX = (dx / dist) * this.speed;
    const moveY = (dy / dist) * this.speed;
    this._tryMove(moveX, moveY, map);
    this._updateFacing(targetX, targetY);
  }

  _tryMove(moveX, moveY, map) {
    const nextX = this.x + moveX;
    const nextY = this.y + moveY;

    if (!map.rectSolid(nextX + 2, this.y + 2, this.width - 4, this.height - 4)) {
      this.x = nextX;
    }
    if (!map.rectSolid(this.x + 2, nextY + 2, this.width - 4, this.height - 4)) {
      this.y = nextY;
    }
  }

  _updateFacing(targetX, targetY) {
    const dx = targetX - this.cx;
    const dy = targetY - this.cy;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
      this.flipX = dx < 0;
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
  }

  _performAttack(player, combat) {
    if (this.ranged) {
      const color = this.type === 'mage' ? '#c060ff' : '#80c0ff';
      combat.enemyShoot(this, player, this.damage, color, 4.5);
    } else {
      const dist = Math.hypot(player.cx - this.cx, player.cy - this.cy);
      if (dist < this.attackRange) {
        player.takeDamage(this.damage);
        Particles.playerHurt(player.cx, player.cy);
      }
    }
  }

  collectLoot() {
    if (this.lootGiven) return 0;
    this.lootGiven = true;
    const [min, max] = this.bloodDrop;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  get readyToRemove() {
    return this.dead && this.deathTimer > 600;
  }

  render(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;
    if (this.dead && this.deathTimer > 500) return;

    ctx.save();

    if (this.dead) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 500);
    }

    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer / 60) % 2 === 0) {
      ctx.filter = 'brightness(2.5) saturate(3)';
    }

    const renderSize = this.width * 1.8;
    const rx = this.x - (renderSize - this.width) / 2;
    const ry = this.y - (renderSize - this.height);

    Sprites.drawEnemySprite(ctx, this.type, this.anim.currentFrame, rx, ry, renderSize, this.flipX);

    ctx.restore();

    if (this.state === 'attack' && this.ranged && this.attackCooldown > this.attackCooldownMax - 300) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff3347';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderHpBar(ctx) {
    if (this.dead || this.hp >= this.maxHp) return;
    const bw = 28, bh = 3;
    const bx = this.cx - bw/2;
    const by = this.y - 8;
    const pct = Math.max(0, this.hp / this.maxHp);

    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#cc1122';
    ctx.fillRect(bx, by, Math.round(bw * pct), bh);
  }
}

/* ── ENEMY MANAGER (spawn / update / cleanup helpers) ── */
class EnemyManager {
  constructor() {
    this.enemies = [];
  }

  spawnFromMapData(mapData) {
    this.enemies = (mapData.enemies || []).map(e => new Enemy(e.type, e.tx, e.ty));
  }

  update(dt, map, player, combat) {
    for (const e of this.enemies) {
      e.update(dt, map, player, combat);
    }
    let bloodEarned = 0;
    this.enemies = this.enemies.filter(e => {
      if (e.readyToRemove) {
        bloodEarned += e.collectLoot();
        return false;
      }
      return true;
    });
    return bloodEarned;
  }

  render(ctx, camera) {
    for (const e of this.enemies) {
      e.render(ctx, camera);
      e.renderHpBar(ctx);
    }
  }

  get aliveCount() {
    return this.enemies.filter(e => !e.dead).length;
  }

  clear() {
    this.enemies = [];
  }
}

window.Enemy = Enemy;
window.EnemyManager = EnemyManager;