/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — particles.js
   Particle system for blood splatter, ability FX, hit sparks,
   death explosions, lava embers, and ambient world effects.
═══════════════════════════════════════════════════════════════ */

class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? (Math.random() - 0.5) * 4;
    this.vy = opts.vy ?? (Math.random() - 0.5) * 4;
    this.size = opts.size ?? 4;
    this.sizeDecay = opts.sizeDecay ?? 0;
    this.life = opts.life ?? 600;        // ms
    this.maxLife = this.life;
    this.color = opts.color ?? '#ff3347';
    this.color2 = opts.color2 ?? null;   // optional fade-to color
    this.gravity = opts.gravity ?? 0.08;
    this.friction = opts.friction ?? 0.96;
    this.glow = opts.glow ?? false;
    this.shape = opts.shape ?? 'circle'; // 'circle' | 'square' | 'star'
    this.alpha = opts.alpha ?? 1;
    this.rotation = opts.rotation ?? 0;
    this.rotSpeed = opts.rotSpeed ?? 0;
    this.bounce = opts.bounce ?? false;
    this.bounced = false;
    this.dead = false;
  }

  update(dt, map) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;

    // Simple ground bounce (if enabled)
    if (this.bounce && map && map.isSolid(this.x, this.y + this.size)) {
      if (!this.bounced) {
        this.vy *= -0.4;
        this.vx *= 0.6;
        this.bounced = true;
      }
    }

    if (this.sizeDecay) this.size = Math.max(0.2, this.size - this.sizeDecay);
    if (this.rotSpeed) this.rotation += this.rotSpeed;
    this.dead = this.life <= 0 || this.size < 0.2;
  }

  draw(ctx) {
    const progress = this.life / this.maxLife;
    const alpha = this.alpha * progress;
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.glow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.size * 2.5;
    }

    // Color lerp between color and color2 based on life progress
    ctx.fillStyle = this.color;

    if (this.shape === 'square') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else if (this.shape === 'star') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      this._drawStar(ctx, 0, 0, this.size * 0.4, this.size, 4);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawStar(ctx, cx, cy, innerR, outerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
               : ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  }
}

/* ══════════════════════════════════════════════════════════════
   PARTICLE EMITTER SYSTEM
══════════════════════════════════════════════════════════════ */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 600;
  }

  add(particle) {
    if (this.particles.length < this.maxParticles) {
      this.particles.push(particle);
    }
  }

  /* Emit multiple particles with shared options */
  emit(x, y, count, opts) {
    for (let i = 0; i < count; i++) {
      this.add(new Particle(x, y, typeof opts === 'function' ? opts(i) : { ...opts }));
    }
  }

  update(dt, map) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt, map);
      if (this.particles[i].dead) this.particles.splice(i, 1);
    }
  }

  render(ctx) {
    for (const p of this.particles) p.draw(ctx);
  }

  clear() { this.particles = []; }

  /* ── PRESET EFFECTS ── */

  /**
   * Blood splatter when entity takes damage
   */
  bloodSplatter(x, y, intensity = 1) {
    const count = Math.floor(6 * intensity);
    this.emit(x, y, count, (i) => ({
      vx: (Math.random() - 0.5) * 5 * intensity,
      vy: -Math.random() * 4 * intensity,
      size: 2 + Math.random() * 3,
      sizeDecay: 0.04,
      life: 500 + Math.random() * 400,
      color: i % 3 === 0 ? '#8b0000' : '#cc1122',
      gravity: 0.15,
      friction: 0.94,
      bounce: true
    }));

    // Small droplets
    this.emit(x, y, Math.floor(3 * intensity), () => ({
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 6,
      size: 1 + Math.random() * 1.5,
      sizeDecay: 0.05,
      life: 400 + Math.random() * 200,
      color: '#ff2233',
      gravity: 0.2,
      friction: 0.93
    }));
  }

  /**
   * Blood Surge ability visual
   */
  bloodSurge(x, y, dirX, dirY) {
    const count = 14;
    const baseAngle = Math.atan2(dirY, dirX);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const angle = baseAngle + spread;
      const speed = 4 + Math.random() * 4;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        sizeDecay: 0.08,
        life: 350 + Math.random() * 200,
        color: '#ff3347',
        glow: true,
        gravity: 0.05,
        friction: 0.95
      }));
    }
    // Central burst
    this.emit(x, y, 5, () => ({
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      size: 5 + Math.random() * 4,
      sizeDecay: 0.12,
      life: 250,
      color: '#ff6070',
      glow: true,
      gravity: 0
    }));
  }

  /**
   * Crimson Whirl — 360 degree spin burst
   */
  crimsonWhirl(x, y) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        sizeDecay: 0.06,
        life: 500 + Math.random() * 200,
        color: i % 2 === 0 ? '#ff3347' : '#cc0020',
        glow: true,
        gravity: 0.02,
        friction: 0.96
      }));
    }
  }

  /**
   * Hemorrhage — fire-blood aura
   */
  hemorrhage(x, y) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 30;
      this.add(new Particle(x + Math.cos(angle)*r, y + Math.sin(angle)*r, {
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 3,
        size: 4 + Math.random() * 4,
        sizeDecay: 0.06,
        life: 400 + Math.random() * 300,
        color: i % 3 === 0 ? '#ff8030' : '#ff3347',
        glow: true,
        gravity: -0.05,
        friction: 0.97
      }));
    }
  }

  /**
   * Death Mark — dark rune glow on enemy
   */
  deathMark(x, y) {
    this.emit(x, y, 16, (i) => {
      const angle = (i / 16) * Math.PI * 2;
      return {
        vx: Math.cos(angle) * (1 + Math.random()),
        vy: Math.sin(angle) * (1 + Math.random()),
        size: 3 + Math.random() * 2,
        sizeDecay: 0.03,
        life: 800,
        color: '#9900bb',
        glow: true,
        gravity: -0.02,
        friction: 0.99
      };
    });
  }

  /**
   * Blood Tide — massive screen wave
   */
  bloodTide(x, y, screenWidth) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      this.add(new Particle(x, y + (Math.random() - 0.5) * 60, {
        vx: 10 + Math.random() * 6,
        vy: (Math.random() - 0.5) * 2,
        size: 6 + Math.random() * 8,
        sizeDecay: 0.04,
        life: 600 + Math.random() * 300,
        color: i % 3 === 0 ? '#cc0020' : '#ff3347',
        glow: true,
        gravity: 0,
        friction: 0.99
      }));
    }
  }

  /**
   * Sanguine Sacrifice — screen-wide explosion
   */
  sanguineSacrifice(x, y) {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 10;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 8,
        sizeDecay: 0.05,
        life: 700 + Math.random() * 400,
        color: i % 4 === 0 ? '#ff9900' : '#ff3347',
        glow: true,
        gravity: 0.04,
        friction: 0.97,
        shape: i % 5 === 0 ? 'star' : 'circle'
      }));
    }
  }

  /**
   * Hit spark (basic attack impact)
   */
  hitSpark(x, y) {
    this.emit(x, y, 8, () => ({
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5 - 1,
      size: 2 + Math.random() * 2,
      sizeDecay: 0.1,
      life: 200 + Math.random() * 150,
      color: '#ffe070',
      glow: true,
      gravity: 0.1,
      friction: 0.94
    }));
  }

  /**
   * Enemy death explosion
   */
  enemyDeath(x, y, color = '#4a2020') {
    // Body particles
    this.emit(x, y, 16, () => ({
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 6 - 1,
      size: 3 + Math.random() * 4,
      sizeDecay: 0.06,
      life: 500 + Math.random() * 400,
      color,
      gravity: 0.12,
      friction: 0.95,
      bounce: true
    }));
    // Blood
    this.bloodSplatter(x, y, 2);
  }

  /**
   * Coin / blood drop pickup sparkle
   */
  bloodCoinPickup(x, y) {
    this.emit(x, y, 10, (i) => {
      const angle = (i / 10) * Math.PI * 2;
      return {
        vx: Math.cos(angle) * (2 + Math.random()),
        vy: Math.sin(angle) * (2 + Math.random()) - 2,
        size: 2 + Math.random() * 2,
        sizeDecay: 0.07,
        life: 350 + Math.random() * 200,
        color: '#ff6070',
        glow: true,
        gravity: 0.06,
        friction: 0.97
      };
    });
  }

  /**
   * Lava damage singe
   */
  lavaDamage(x, y) {
    this.emit(x, y, 8, () => ({
      vx: (Math.random() - 0.5) * 3,
      vy: -2 - Math.random() * 4,
      size: 3 + Math.random() * 3,
      sizeDecay: 0.08,
      life: 400,
      color: i => i % 2 === 0 ? '#ff6020' : '#ff9940',
      glow: true,
      gravity: -0.02
    }));
  }

  /**
   * Player hurt flash particles
   */
  playerHurt(x, y) {
    this.emit(x, y, 12, () => ({
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4,
      size: 2 + Math.random() * 3,
      sizeDecay: 0.07,
      life: 300 + Math.random() * 200,
      color: '#ff6070',
      glow: true,
      gravity: 0.08
    }));
  }

  /**
   * Chest open sparkle
   */
  chestOpen(x, y) {
    this.emit(x, y, 20, (i) => {
      const angle = (i / 20) * Math.PI * 2;
      return {
        vx: Math.cos(angle) * (2 + Math.random() * 4),
        vy: Math.sin(angle) * (2 + Math.random() * 4) - 3,
        size: 3 + Math.random() * 4,
        sizeDecay: 0.05,
        life: 600 + Math.random() * 300,
        color: i % 3 === 0 ? '#ffcc02' : '#ff9900',
        glow: true,
        gravity: 0.1,
        shape: i % 4 === 0 ? 'star' : 'circle'
      };
    });
  }

  /**
   * Boss phase transition explosion
   */
  bossPhaseTransition(x, y) {
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 12;
      this.add(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        sizeDecay: 0.04,
        life: 800 + Math.random() * 600,
        color: [
          '#ff3347', '#ff6070', '#ffcc02', '#8b1a24', '#ff9900'
        ][Math.floor(Math.random() * 5)],
        glow: true,
        gravity: 0.06,
        friction: 0.97,
        shape: Math.random() > 0.7 ? 'star' : 'circle'
      }));
    }
  }
}

/* Global singleton */
window.Particles = new ParticleSystem();