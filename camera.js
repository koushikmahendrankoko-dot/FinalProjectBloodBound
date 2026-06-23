/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — camera.js (v3 — Elden Ring edition)
   Directional look-ahead, layered screen shake by severity,
   hit-stop freeze frames, consumeHitStop for game loop.
═══════════════════════════════════════════════════════════════ */

class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0; this.y = 0;
    this.width  = canvasWidth;
    this.height = canvasHeight;
    this.targetX = 0; this.targetY = 0;
    this.lerp    = 0.09;

    // Look-ahead offset (follows input direction slightly)
    this.lookX = 0; this.lookY = 0;
    this.LOOK_DIST = 48;

    // Screen shake layers
    this.shakeX = 0; this.shakeY = 0;
    this.shakes = []; // { mag, dur, elapsed, severity }

    // Hit-stop
    this.hitStopRemaining = 0;

    // World bounds
    this.worldWidth  = 0;
    this.worldHeight = 0;
  }

  resize(w, h) { this.width=w; this.height=h; }

  setWorldSize(w, h) { this.worldWidth=w; this.worldHeight=h; }

  /* Follow player with directional look-ahead */
  follow(worldX, worldY, inputDirX=0, inputDirY=0) {
    const targetLookX = inputDirX * this.LOOK_DIST;
    const targetLookY = inputDirY * this.LOOK_DIST;
    this.lookX += (targetLookX - this.lookX) * 0.06;
    this.lookY += (targetLookY - this.lookY) * 0.06;

    this.targetX = worldX - this.width/2  + this.lookX;
    this.targetY = worldY - this.height/2 + this.lookY;
  }

  /* Trigger screen shake
     severity: 'normal' | 'heavy' | 'crit' */
  shake(magnitude, duration, severity='normal') {
    if (!window.GameSettings || window.GameSettings.screenShake===false) return;
    const mult = severity==='crit'?1.4 : severity==='heavy'?1.1 : 1.0;
    this.shakes.push({ mag:magnitude*mult, dur:duration, elapsed:0, severity });
  }

  /* Freeze gameplay dt for hit-stop frames */
  hitStop(ms) {
    if (!window.GameSettings || window.GameSettings.hitStop===false) return;
    if (ms > this.hitStopRemaining) this.hitStopRemaining = ms;
  }

  /* Called at top of game loop — returns 0 during freeze, dt otherwise */
  consumeHitStop(dt) {
    if (this.hitStopRemaining <= 0) return dt;
    this.hitStopRemaining -= dt;
    return 0; // freeze gameplay
  }

  update(dt) {
    // Smooth follow
    this.x += (this.targetX - this.x) * this.lerp;
    this.y += (this.targetY - this.y) * this.lerp;

    // Clamp to world bounds
    if (this.worldWidth  > 0) this.x = Math.max(0, Math.min(this.x, this.worldWidth  - this.width));
    if (this.worldHeight > 0) this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.height));

    // Composite screen shake from all active layers
    this.shakeX = 0; this.shakeY = 0;
    for (let i=this.shakes.length-1; i>=0; i--) {
      const s = this.shakes[i];
      s.elapsed += dt;
      if (s.elapsed >= s.dur) { this.shakes.splice(i,1); continue; }
      const progress = 1 - s.elapsed/s.dur;
      const mag = s.mag * progress;
      // Heavier shakes use larger random offsets
      const jitter = s.severity==='crit' ? 2 : s.severity==='heavy' ? 1.4 : 1;
      this.shakeX += (Math.random()-0.5)*2*mag*jitter;
      this.shakeY += (Math.random()-0.5)*2*mag*jitter;
    }
  }

  apply(ctx) {
    ctx.save();
    ctx.translate(Math.round(-this.x+this.shakeX), Math.round(-this.y+this.shakeY));
  }

  restore(ctx) { ctx.restore(); }

  worldToScreen(wx, wy) {
    return { x:wx-this.x+this.shakeX, y:wy-this.y+this.shakeY };
  }

  screenToWorld(sx, sy) {
    return { x:sx+this.x-this.shakeX, y:sy+this.y-this.shakeY };
  }

  isVisible(wx, wy, w, h, margin=32) {
    return wx+w+margin > this.x && wx-margin < this.x+this.width &&
           wy+h+margin > this.y && wy-margin < this.y+this.height;
  }

  snapTo(worldX, worldY) {
    this.x = this.targetX = worldX - this.width/2;
    this.y = this.targetY = worldY - this.height/2;
    if (this.worldWidth  > 0) this.x = this.targetX = Math.max(0, Math.min(this.x, this.worldWidth  - this.width));
    if (this.worldHeight > 0) this.y = this.targetY = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
    this.shakes = [];
  }
}

window.Camera = Camera;