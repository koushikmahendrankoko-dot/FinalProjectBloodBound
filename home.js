/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — home.js
   Landing page: hero pixel character, blood drip decorations
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  drawHeroSprite();
  createBloodDrips();
  updatePlayButtons();
});

/* ── HERO PIXEL CHARACTER ──
   Draws a simple hooded figure with a glowing blood-rune hand,
   built entirely from rectangles on a pixel grid. */
function drawHeroSprite() {
  const canvas = document.getElementById('hero-sprite-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const GRID = 20; // 20x28 pixel grid mapped to canvas
  const cw = canvas.width / GRID;
  const ch = canvas.height / (GRID * 1.4);

  ctx.imageSmoothingEnabled = false;

  // Palette
  const COLORS = {
    cloak:    '#1a0308',
    cloakLt:  '#2a0610',
    skin:     '#c9a0a0',
    hood:     '#0d0203',
    rune:     '#ff3347',
    runeGlow: '#ff6070',
    boots:    '#0a0000',
    belt:     '#5c1018'
  };

  // Pixel map: row by row (28 rows x 20 cols), 0 = empty
  // Simplified hooded figure silhouette
  const map = [
    '00000111111100000000',
    '00000111111100000000',
    '00001111111110000000',
    '00001122222110000000',
    '00001222222210000000',
    '00001222222210000000',
    '00001122222110000000',
    '00000111111100000000',
    '00001111111110000000',
    '00011111111111000000',
    '00111111111111100000',
    '00111111111111100000',
    '00111133333111100000',
    '01111133333111110000',
    '01111133333111110000',
    '01111111111111110000',
    '00111111111111100000',
    '00111144111111100000',
    '00111444444111100000',
    '00115555555551100000',
    '00115555555551100000',
    '00011555555511000000',
    '00011666666611000000',
    '00001166666110000000',
    '00001166666110000000',
    '00000077007700000000',
    '00000077007700000000',
    '00000077007700000000'
  ];

  let frame = 0;
  const FRAME_COUNT = 60;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bob = Math.sin(frame * 0.05) * 2; // idle breathing bob
    const runeFlicker = 0.7 + 0.3 * Math.sin(frame * 0.15);

    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        const c = map[row][col];
        if (c === '0') continue;

        let color;
        switch (c) {
          case '1': color = COLORS.hood; break;
          case '2': color = COLORS.cloak; break;
          case '3': color = COLORS.skin; break;
          case '4': color = COLORS.belt; break;
          case '5': color = COLORS.cloakLt; break;
          case '6': color = COLORS.cloak; break;
          case '7': color = COLORS.boots; break;
          default: color = COLORS.cloak;
        }

        ctx.fillStyle = color;
        ctx.fillRect(col * cw, row * ch + bob, cw + 0.5, ch + 0.5);
      }
    }

    // Glowing blood rune on right hand (around row 19, col 15)
    ctx.save();
    ctx.globalAlpha = runeFlicker;
    ctx.fillStyle = COLORS.runeGlow;
    ctx.shadowColor = COLORS.rune;
    ctx.shadowBlur = 8;
    ctx.fillRect(15 * cw, 19 * ch + bob, cw, ch);
    ctx.restore();

    // Eyes glow inside hood
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(frame * 0.08);
    ctx.fillStyle = '#ff6070';
    ctx.shadowColor = '#ff3347';
    ctx.shadowBlur = 4;
    ctx.fillRect(8 * cw, 5 * ch + bob, cw * 0.8, ch * 0.8);
    ctx.fillRect(11 * cw, 5 * ch + bob, cw * 0.8, ch * 0.8);
    ctx.restore();

    frame = (frame + 1) % (FRAME_COUNT * 4);
    requestAnimationFrame(render);
  }

  render();
}

/* ── BLOOD DRIP DECORATIONS (CTA banner) ── */
function createBloodDrips() {
  const container = document.getElementById('drip-container');
  if (!container) return;

  const DRIP_COUNT = 8;
  for (let i = 0; i < DRIP_COUNT; i++) {
    const drip = document.createElement('div');
    drip.className = 'drip';
    const height = 40 + Math.random() * 80;
    const duration = 2 + Math.random() * 3;
    const delay = Math.random() * 4;
    drip.style.setProperty('--h', `${height}px`);
    drip.style.setProperty('--dur', `${duration}s`);
    drip.style.setProperty('--delay', `${delay}s`);
    container.appendChild(drip);
  }
}

/* ── PLAY BUTTON LABELS BASED ON LOGIN STATE ── */
function updatePlayButtons() {
  if (!window.BB) return;

  const isLoggedIn = window.BB.isLoggedIn();
  if (!isLoggedIn) return; // default labels are fine for guests

  // If logged in and has progress, change CTA wording
  const progress = window.BB.getProgressSummary();
  if (progress.chapter > 1 || progress.bloodCoins > 0) {
    document.querySelectorAll('.btn-primary').forEach(btn => {
      const span = btn.querySelector('span:not(.btn-icon)');
      if (span && /BEGIN YOUR CURSE|PLAY BLOODBOUND/.test(span.textContent)) {
        span.textContent = span.textContent.includes('FREE')
          ? `CONTINUE — ${progress.chapterName.toUpperCase()}`
          : 'CONTINUE YOUR CURSE';
      }
    });
  }
}