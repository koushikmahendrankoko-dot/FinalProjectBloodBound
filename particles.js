/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — particles.js (v3 — Elden Ring edition)
   Full particle system: blood, abilities, dodge dust, parry ring,
   crit shockwave, footstep dust, torch flicker, off-screen culling.
═══════════════════════════════════════════════════════════════ */

class Particle {
  constructor(x, y, opts={}) {
    this.x = x; this.y = y;
    this.vx       = opts.vx ?? (Math.random()-0.5)*4;
    this.vy       = opts.vy ?? (Math.random()-0.5)*4;
    this.size     = opts.size     ?? 4;
    this.sizeDecay= opts.sizeDecay?? 0;
    this.life     = opts.life     ?? 600;
    this.maxLife  = this.life;
    this.color    = opts.color    ?? '#ff3347';
    this.gravity  = opts.gravity  ?? 0.08;
    this.friction = opts.friction ?? 0.96;
    this.glow     = opts.glow     ?? false;
    this.shape    = opts.shape    ?? 'circle';
    this.alpha    = opts.alpha    ?? 1;
    this.rotation = opts.rotation ?? 0;
    this.rotSpeed = opts.rotSpeed ?? 0;
    this.trail    = opts.trail    ?? false;
    this.dead     = false;
  }

  update(dt, map) {
    this.life -= dt;
    if (this.life <= 0) { this.dead=true; return; }
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x  += this.vx;
    this.y  += this.vy;
    if (this.sizeDecay) this.size = Math.max(0.2, this.size-this.sizeDecay);
    if (this.rotSpeed)  this.rotation += this.rotSpeed;
    this.dead = this.life<=0 || this.size<0.2;
  }

  draw(ctx) {
    const progress = this.life/this.maxLife;
    const alpha    = this.alpha * progress;
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.glow) { ctx.shadowColor=this.color; ctx.shadowBlur=this.size*2.5; }
    ctx.fillStyle = this.color;
    if (this.shape==='square') {
      ctx.translate(this.x,this.y); ctx.rotate(this.rotation);
      ctx.fillRect(-this.size/2,-this.size/2,this.size,this.size);
    } else if (this.shape==='ring') {
      ctx.strokeStyle=this.color; ctx.lineWidth=2; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles  = [];
    this.maxParticles = 800;
  }

  add(p) { if (this.particles.length < this.maxParticles) this.particles.push(p); }

  emit(x, y, count, opts) {
    for (let i=0; i<count; i++) {
      this.add(new Particle(x, y, typeof opts==='function' ? opts(i) : {...opts}));
    }
  }

  update(dt, map) {
    for (let i=this.particles.length-1; i>=0; i--) {
      this.particles[i].update(dt, map);
      if (this.particles[i].dead) this.particles.splice(i,1);
    }
  }

  render(ctx, camera) {
    for (const p of this.particles) {
      // Off-screen culling
      if (camera && !camera.isVisible(p.x-p.size, p.y-p.size, p.size*2, p.size*2, 16)) continue;
      p.draw(ctx);
    }
  }

  clear() { this.particles=[]; }

  /* ── PRESETS ── */

  bloodSplatter(x, y, intensity=1) {
    const count = Math.floor(7*intensity);
    this.emit(x, y, count, (i)=>({
      vx:(Math.random()-0.5)*5*intensity, vy:-Math.random()*4*intensity,
      size:2+Math.random()*3, sizeDecay:0.04,
      life:500+Math.random()*400,
      color: i%3===0?'#8b0000':'#cc1122',
      gravity:0.15, friction:0.94
    }));
    this.emit(x, y, Math.floor(3*intensity), ()=>({
      vx:(Math.random()-0.5)*9, vy:-Math.random()*7,
      size:1+Math.random()*1.5, sizeDecay:0.05,
      life:300+Math.random()*200, color:'#ff2233',
      gravity:0.22, friction:0.93
    }));
  }

  hitSpark(x, y) {
    this.emit(x, y, 10, ()=>({
      vx:(Math.random()-0.5)*7, vy:-Math.random()*5-1,
      size:2+Math.random()*2, sizeDecay:0.1,
      life:200+Math.random()*150, color:'#ffe070',
      glow:true, gravity:0.1, friction:0.94
    }));
  }

  critImpact(x, y) {
    // Shockwave ring
    for (let i=0; i<3; i++) {
      this.add(new Particle(x, y, {
        size:4+i*6, sizeDecay:-1.2, life:220+i*40,
        color:'#ffcc02', glow:true, gravity:0, friction:1,
        vx:0, vy:0, shape:'ring', alpha:0.7-i*0.15
      }));
    }
    // Gold sparks
    this.emit(x, y, 18, (i)=>{
      const angle = (i/18)*Math.PI*2;
      const speed = 4+Math.random()*5;
      return { vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
               size:3+Math.random()*3, sizeDecay:0.07,
               life:400+Math.random()*200, color:'#ffcc02',
               glow:true, gravity:0.06, friction:0.97 };
    });
  }

  bloodSurge(x, y, dirX, dirY) {
    const baseAngle = Math.atan2(dirY, dirX);
    for (let i=0; i<16; i++) {
      const spread = (Math.random()-0.5)*0.9;
      const angle  = baseAngle+spread;
      const speed  = 5+Math.random()*5;
      this.add(new Particle(x, y, {
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        size:3+Math.random()*3, sizeDecay:0.08,
        life:350+Math.random()*200, color:'#ff3347',
        glow:true, gravity:0.04, friction:0.95
      }));
    }
    this.emit(x, y, 5, ()=>({ vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, size:6+Math.random()*4, sizeDecay:0.14, life:200, color:'#ff6070', glow:true, gravity:0 }));
  }

  crimsonWhirl(x, y) {
    for (let i=0; i<28; i++) {
      const angle = (i/28)*Math.PI*2;
      const speed = 3+Math.random()*5;
      this.add(new Particle(x, y, {
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        size:3+Math.random()*3, sizeDecay:0.06,
        life:500+Math.random()*200, color:i%2===0?'#ff3347':'#cc0020',
        glow:true, gravity:0.02, friction:0.96
      }));
    }
  }

  hemorrhage(x, y) {
    for (let i=0; i<10; i++) {
      const angle = Math.random()*Math.PI*2;
      const r     = 20+Math.random()*30;
      this.add(new Particle(x+Math.cos(angle)*r, y+Math.sin(angle)*r, {
        vx:(Math.random()-0.5)*2, vy:-1-Math.random()*3,
        size:4+Math.random()*4, sizeDecay:0.06,
        life:400+Math.random()*300,
        color:i%3===0?'#ff8030':'#ff3347',
        glow:true, gravity:-0.05, friction:0.97
      }));
    }
  }

  deathMark(x, y) {
    this.emit(x, y, 16, (i)=>{
      const angle=(i/16)*Math.PI*2;
      return { vx:Math.cos(angle)*(1+Math.random()), vy:Math.sin(angle)*(1+Math.random()),
               size:3+Math.random()*2, sizeDecay:0.03, life:800,
               color:'#9900bb', glow:true, gravity:-0.02, friction:0.99 };
    });
  }

  bloodTide(x, y) {
    for (let i=0; i<30; i++) {
      this.add(new Particle(x, y+(Math.random()-0.5)*80, {
        vx:10+Math.random()*6, vy:(Math.random()-0.5)*2,
        size:6+Math.random()*8, sizeDecay:0.04,
        life:600+Math.random()*300,
        color:i%3===0?'#cc0020':'#ff3347',
        glow:true, gravity:0, friction:0.99
      }));
    }
  }

  sanguineSacrifice(x, y) {
    for (let i=0; i<50; i++) {
      const angle=(Math.random()*Math.PI*2);
      const speed=5+Math.random()*12;
      this.add(new Particle(x, y, {
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        size:5+Math.random()*9, sizeDecay:0.05,
        life:700+Math.random()*400,
        color:['#ff3347','#ff6070','#ffcc02','#8b1a24','#ff9900'][i%5],
        glow:true, gravity:0.05, friction:0.97,
        shape:i%5===0?'square':'circle'
      }));
    }
    this.critImpact(x, y);
  }

  // ── NEW v3 effects ──

  footstepDust(x, y) {
    this.emit(x, y, 3, ()=>({
      vx:(Math.random()-0.5)*1.5, vy:-Math.random()*0.8,
      size:2+Math.random()*2, sizeDecay:0.06,
      life:200+Math.random()*100,
      color:'rgba(80,40,30,0.6)', gravity:-0.01, friction:0.97
    }));
  }

  rollDust(x, y) {
    this.emit(x, y, 10, ()=>({
      vx:(Math.random()-0.5)*4, vy:-Math.random()*2,
      size:3+Math.random()*3, sizeDecay:0.07,
      life:280+Math.random()*150,
      color:'rgba(120,60,40,0.5)', gravity:0.02, friction:0.95
    }));
  }

  parryReady(x, y) {
    for (let i=0; i<12; i++) {
      const angle=(i/12)*Math.PI*2;
      this.add(new Particle(x, y, {
        vx:Math.cos(angle)*2, vy:Math.sin(angle)*2,
        size:3, sizeDecay:0.05, life:300,
        color:'#ffcc02', glow:true, gravity:0, friction:0.98
      }));
    }
  }

  parrySuccess(x, y) {
    this.critImpact(x, y);
    this.emit(x, y, 20, (i)=>{
      const angle=(i/20)*Math.PI*2;
      return { vx:Math.cos(angle)*(3+Math.random()*4), vy:Math.sin(angle)*(3+Math.random()*4),
               size:4+Math.random()*4, sizeDecay:0.06, life:500+Math.random()*200,
               color:'#ffcc02', glow:true, gravity:0.04, friction:0.97 };
    });
  }

  enemyDeath(x, y, color='#4a2020') {
    this.emit(x, y, 18, ()=>({
      vx:(Math.random()-0.5)*7, vy:-Math.random()*6-1,
      size:3+Math.random()*4, sizeDecay:0.06,
      life:500+Math.random()*400, color,
      gravity:0.12, friction:0.95
    }));
    this.bloodSplatter(x, y, 2);
  }

  playerHurt(x, y) {
    this.emit(x, y, 14, ()=>({
      vx:(Math.random()-0.5)*6, vy:-Math.random()*4,
      size:2+Math.random()*3, sizeDecay:0.07,
      life:300+Math.random()*200, color:'#ff6070',
      glow:true, gravity:0.08
    }));
  }

  bloodCoinPickup(x, y) {
    this.emit(x, y, 10, (i)=>{
      const angle=(i/10)*Math.PI*2;
      return { vx:Math.cos(angle)*(2+Math.random()), vy:Math.sin(angle)*(2+Math.random())-2,
               size:2+Math.random()*2, sizeDecay:0.07, life:350+Math.random()*200,
               color:'#ff6070', glow:true, gravity:0.06, friction:0.97 };
    });
  }

  chestOpen(x, y) {
    this.emit(x, y, 22, (i)=>{
      const angle=(i/22)*Math.PI*2;
      return { vx:Math.cos(angle)*(2+Math.random()*4), vy:Math.sin(angle)*(2+Math.random()*4)-3,
               size:3+Math.random()*4, sizeDecay:0.05,
               life:600+Math.random()*300,
               color:i%3===0?'#ffcc02':'#ff9900',
               glow:true, gravity:0.1, shape:i%4===0?'square':'circle' };
    });
  }

  bossPhaseTransition(x, y) {
    for (let i=0; i<60; i++) {
      const angle=Math.random()*Math.PI*2;
      const speed=3+Math.random()*14;
      this.add(new Particle(x, y, {
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        size:4+Math.random()*9, sizeDecay:0.04,
        life:800+Math.random()*600,
        color:['#ff3347','#ff6070','#ffcc02','#8b1a24','#ff9900'][Math.floor(Math.random()*5)],
        glow:true, gravity:0.06, friction:0.97,
        shape:Math.random()>0.7?'square':'circle'
      }));
    }
    this.critImpact(x, y);
  }

  lavaDamage(x, y) {
    this.emit(x, y, 8, ()=>({
      vx:(Math.random()-0.5)*3, vy:-2-Math.random()*4,
      size:3+Math.random()*3, sizeDecay:0.08, life:400,
      color:Math.random()>0.5?'#ff6020':'#ff9940',
      glow:true, gravity:-0.02
    }));
  }

  torchFlicker(x, y) {
    this.add(new Particle(x, y, {
      vx:(Math.random()-0.5)*0.8, vy:-0.8-Math.random()*1.2,
      size:3+Math.random()*2, sizeDecay:0.09,
      life:300+Math.random()*200,
      color:Math.random()>0.4?'#ff8030':'#ffcc02',
      glow:true, gravity:-0.03, friction:0.98
    }));
  }
}

window.Particles = new ParticleSystem();