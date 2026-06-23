/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — camera.js
   Smooth camera follow, world-to-screen transforms, screen shake
═══════════════════════════════════════════════════════════════ */

class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;          // world position of top-left corner
    this.y = 0;
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.targetX = 0;
    this.targetY = 0;
    this.lerp = 0.10;    // follow smoothness (0=instant, 1=never)

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
    this.shakeDur = 0;
    this.shakeElapsed = 0;

    // World bounds (set when map loads)
    this.worldWidth = 0;
    this.worldHeight = 0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  setWorldSize(w, h) {
    this.worldWidth = w;
    this.worldHeight = h;
  }

  /* Point the camera at a world position (usually player center) */
  follow(worldX, worldY) {
    this.targetX = worldX - this.width / 2;
    this.targetY = worldY - this.height / 2;
  }

  /* Trigger a screen shake (magnitude in px, duration in ms) */
  shake(magnitude, duration) {
    if (!window.GameSettings || window.GameSettings.screenShake !== false) {
      this.shakeMag = magnitude;
      this.shakeDur = duration;
      this.shakeElapsed = 0;
    }
  }

  update(dt) {
    // Smooth follow
    this.x += (this.targetX - this.x) * this.lerp;
    this.y += (this.targetY - this.y) * this.lerp;

    // Clamp to world bounds
    if (this.worldWidth > 0) {
      this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.width));
    }
    if (this.worldHeight > 0) {
      this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
    }

    // Screen shake
    if (this.shakeElapsed < this.shakeDur) {
      this.shakeElapsed += dt;
      const progress = 1 - this.shakeElapsed / this.shakeDur;
      const mag = this.shakeMag * progress;
      this.shakeX = (Math.random() - 0.5) * 2 * mag;
      this.shakeY = (Math.random() - 0.5) * 2 * mag;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  /* Apply camera transform to ctx before drawing world objects */
  apply(ctx) {
    ctx.save();
    ctx.translate(
      Math.round(-this.x + this.shakeX),
      Math.round(-this.y + this.shakeY)
    );
  }

  /* Call after drawing all world objects */
  restore(ctx) {
    ctx.restore();
  }

  /* Convert world coordinates to screen coordinates */
  worldToScreen(wx, wy) {
    return {
      x: wx - this.x + this.shakeX,
      y: wy - this.y + this.shakeY
    };
  }

  /* Convert screen coordinates to world coordinates */
  screenToWorld(sx, sy) {
    return {
      x: sx + this.x - this.shakeX,
      y: sy + this.y - this.shakeY
    };
  }

  /* Check if a world rect is visible (used for culling off-screen objects) */
  isVisible(wx, wy, w, h, margin = 32) {
    return (
      wx + w + margin > this.x &&
      wx - margin < this.x + this.width &&
      wy + h + margin > this.y &&
      wy - margin < this.y + this.height
    );
  }

  /* Instantly snap to a world position (no lerp, e.g. on room transition) */
  snapTo(worldX, worldY) {
    this.x = this.targetX = worldX - this.width / 2;
    this.y = this.targetY = worldY - this.height / 2;
    if (this.worldWidth > 0) {
      this.x = this.targetX = Math.max(0, Math.min(this.x, this.worldWidth - this.width));
    }
    if (this.worldHeight > 0) {
      this.y = this.targetY = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
    }
  }
}

window.Camera = Camera;