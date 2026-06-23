/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — sprites.js
   Procedural pixel-art sprite system. All characters, enemies,
   bosses, and tiles are drawn from pixel-grid maps — no image
   files required. Each sprite supports multiple animation frames.
═══════════════════════════════════════════════════════════════ */

const TILE_SIZE = 32; // world tile size in pixels (base resolution)

/* ── COLOR PALETTE ──
   Shared palette so all sprites feel cohesive with the site theme. */
const PAL = {
  // Player / hero
  heroCloak:   '#1a0308',
  heroCloakLt: '#2a0610',
  heroSkin:    '#c9a0a0',
  heroHood:    '#0d0203',
  heroBelt:    '#5c1018',
  heroBoots:   '#0a0000',
  rune:        '#ff3347',
  runeGlow:    '#ff6070',

  // Enemies
  grunt:       '#4a2020',
  gruntDk:     '#2a1010',
  gruntEye:    '#ff6070',
  archer:      '#3a3a50',
  archerDk:    '#1a1a2a',
  mage:        '#4a1a5a',
  mageDk:      '#2a0a3a',
  mageGlow:    '#c060ff',

  // Bosses
  bossPrimary: '#8b1a24',
  bossDark:    '#3d0a0f',
  bossAccent:  '#ffcc02',

  // Tiles
  floorStone:  '#2a1a18',
  floorStoneLt:'#3a2624',
  floorDirt:   '#3a2418',
  floorGrass:  '#1a3018',
  floorGrassLt:'#244018',
  wallStone:   '#1a0c0c',
  wallStoneLt: '#2c1414',
  wallEdge:    '#0a0404',
  water:       '#0a2030',
  waterLt:     '#1a3a50',
  lava:        '#a02010',
  lavaGlow:    '#ff6020',
  bloodPool:   '#4a0008',

  // Misc
  chestWood:   '#4a2a10',
  chestGold:   '#c8a020',
  doorWood:    '#3a2010',
  torch:       '#ff8030',
  void:        'transparent'
};

/* ══════════════════════════════════════════════════════════════
   PIXEL MAP RENDERER
   Draws a pixel-map (array of strings, each char = palette key
   or '0' for empty) onto a context at a given position/scale.
══════════════════════════════════════════════════════════════ */
function drawPixelMap(ctx, map, colorMap, x, y, pixelSize, flipX = false) {
  const rows = map.length;
  const cols = map[0].length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = map[row][col];
      if (key === '0' || key === '.') continue;

      const color = colorMap[key];
      if (!color) continue;

      const drawCol = flipX ? (cols - 1 - col) : col;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(x + drawCol * pixelSize),
        Math.round(y + row * pixelSize),
        Math.ceil(pixelSize),
        Math.ceil(pixelSize)
      );
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   PLAYER SPRITE — "The Cursed One"
   17x20 pixel grid, 4 directions x multiple animation frames
══════════════════════════════════════════════════════════════ */
const PLAYER_PALETTE = {
  '1': PAL.heroHood,
  '2': PAL.heroCloak,
  '3': PAL.heroSkin,
  '4': PAL.heroBelt,
  '5': PAL.heroCloakLt,
  '6': PAL.heroBoots,
  'R': PAL.runeGlow
};

// Idle / walk frames facing DOWN
const PLAYER_DOWN_0 = [
  '00011111100000000',
  '00111111111000000',
  '01111111111100000',
  '01111333111100000',
  '01111333111100000',
  '01111111111100000',
  '00111111111000000',
  '00011111111100000',
  '00011111111100000',
  '00011444441100000',
  '00111444441100000',
  '00111555555110000',
  '00111555555110000',
  '00111555555110000',
  '00011555555100000',
  '00001155555100000',
  '00001155R55100000',
  '00000011551000000',
  '00000666006660000',
  '00000666006660000'
];
const PLAYER_DOWN_1 = [
  '00011111100000000',
  '00111111111000000',
  '01111111111100000',
  '01111333111100000',
  '01111333111100000',
  '01111111111100000',
  '00111111111000000',
  '00011111111100000',
  '00011111111100000',
  '00011444441100000',
  '00111444441100000',
  '00111555555110000',
  '00111555555110000',
  '00111555555110000',
  '00011555555100000',
  '00001555555110000',
  '0000R555551100000',
  '00000015551000000',
  '00000666060660000',
  '00000660006066000'
];

// Facing UP (back of hood — no face visible)
const PLAYER_UP_0 = [
  '00011111100000000',
  '00111111111000000',
  '01111111111100000',
  '01111111111100000',
  '01111111111100000',
  '01111111111100000',
  '00111111111000000',
  '00011111111100000',
  '00011111111100000',
  '00011444441100000',
  '00111444441100000',
  '00111555555110000',
  '00111555555110000',
  '00111555555110000',
  '00011555555100000',
  '00001155555100000',
  '00001155555100000',
  '00000011551000000',
  '00000666006660000',
  '00000666006660000'
];
const PLAYER_UP_1 = PLAYER_UP_0;

// Facing SIDE (drawn facing left — flip for right)
const PLAYER_SIDE_0 = [
  '00001111110000000',
  '00011111111000000',
  '00111111111100000',
  '00111133311000000',
  '00111133311000000',
  '00111111111100000',
  '00011111111000000',
  '00011111111100000',
  '00011111111100000',
  '00011444444100000',
  '00111444444110000',
  '00111555555510000',
  '00111555555510000',
  '00011555555510000',
  '00011555555510000',
  '00001555555R10000',
  '00001555555510000',
  '00000155551000000',
  '00000666006660000',
  '00000666006660000'
];
const PLAYER_SIDE_1 = [
  '00001111110000000',
  '00011111111000000',
  '00111111111100000',
  '00111133311000000',
  '00111133311000000',
  '00111111111100000',
  '00011111111000000',
  '00011111111100000',
  '00011111111100000',
  '00011444444100000',
  '00111444444110000',
  '00111555555510000',
  '00011555555510000',
  '00011555555510000',
  '00001555555510000',
  '0000R555555510000',
  '00000555555510000',
  '00000055551000000',
  '00006660006660000',
  '00006600006600000'
];

// Attack frame (weapon swing) — down-facing
const PLAYER_ATTACK_DOWN = [
  '00011111100000000',
  '00111111111000000',
  '01111111111100000',
  '01111333111100000',
  '01111333111100W00',
  '01111111111100WW0',
  '00111111111000WW0',
  '00011111111100W00',
  '00011111111100000',
  '00011444441100000',
  '00111444441100000',
  '00111555555110000',
  '00111555555110000',
  '00111555555110000',
  '00011555555100000',
  '00001155555100000',
  '00001155R55100000',
  '00000011551000000',
  '00000666006660000',
  '00000666006660000'
];

const PLAYER_FRAMES = {
  down:   [PLAYER_DOWN_0, PLAYER_DOWN_1],
  up:     [PLAYER_UP_0, PLAYER_UP_1],
  left:   [PLAYER_SIDE_0, PLAYER_SIDE_1],
  right:  [PLAYER_SIDE_0, PLAYER_SIDE_1], // flipped at render time
  attackDown: [PLAYER_ATTACK_DOWN]
};

/* Player palette including weapon swing color */
const PLAYER_PALETTE_ATTACK = { ...PLAYER_PALETTE, 'W': '#ffe070' };

/**
 * Draws the player sprite.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} direction - 'up'|'down'|'left'|'right'
 * @param {number} frameIndex - current animation frame
 * @param {number} x - world/screen x (top-left)
 * @param {number} y - world/screen y (top-left)
 * @param {number} size - render width in pixels (height auto-scales)
 * @param {boolean} isAttacking - use attack frame if true (down only for now)
 */
function drawPlayerSprite(ctx, direction, frameIndex, x, y, size, isAttacking) {
  // Real sprite sheet path (if hero.png was provided)
  if (window.Assets && window.Assets.hasImage('player_hero')) {
    return drawSpriteSheetFrame(ctx, window.Assets.getImage('player_hero'), {
      direction, frameIndex, isAttacking, x, y, size,
      frameSize: 64,
      rows: { down: 0, up: 1, left: 2, right: 2, attackDown: 3 }
    });
  }

  let frames = PLAYER_FRAMES[direction] || PLAYER_FRAMES.down;
  let palette = PLAYER_PALETTE;
  let flip = false;

  if (isAttacking && direction === 'down') {
    frames = PLAYER_FRAMES.attackDown;
    palette = PLAYER_PALETTE_ATTACK;
  }
  if (direction === 'right') flip = true;

  const map = frames[frameIndex % frames.length];
  const cols = map[0].length;
  const px = size / cols;

  drawPixelMap(ctx, map, palette, x, y, px, flip);
}

/**
 * Generic sprite-sheet frame drawer for real PNG assets.
 * Assumes a horizontal-strip layout: one row per animation state,
 * frameSize x frameSize per frame, rows ordered per the `rows` map.
 */
function drawSpriteSheetFrame(ctx, img, opts) {
  const { direction, frameIndex, isAttacking, x, y, size, frameSize, rows } = opts;
  const rowKey = isAttacking && rows.attackDown !== undefined ? 'attackDown' : direction;
  const row = rows[rowKey] ?? 0;
  const flip = direction === 'right' && rows.left !== undefined && rows.right === rows.left;

  const framesPerRow = Math.floor(img.width / frameSize);
  const col = frameIndex % Math.max(1, framesPerRow);

  ctx.save();
  if (flip) {
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, col * frameSize, row * frameSize, frameSize, frameSize, 0, 0, size, size);
  } else {
    ctx.drawImage(img, col * frameSize, row * frameSize, frameSize, frameSize, x, y, size, size);
  }
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   ENEMY SPRITES — Grunt, Archer, Mage
   14-column grids
══════════════════════════════════════════════════════════════ */
const GRUNT_PALETTE = {
  '1': PAL.gruntDk,
  '2': PAL.grunt,
  'E': PAL.gruntEye,
  '4': PAL.heroBoots
};
const GRUNT_0 = [
  '00111111110000',
  '01112222211000',
  '01122E22E21000',
  '01122222221000',
  '01112222211000',
  '00111111110000',
  '00122222210000',
  '01222222221000',
  '01222222221000',
  '01222222221000',
  '00122222100000',
  '00122222100000',
  '00144004410000',
  '00144004410000'
];
const GRUNT_1 = [
  '00111111110000',
  '01112222211000',
  '01122E22E21000',
  '01122222221000',
  '01112222211000',
  '00111111110000',
  '00122222210000',
  '01222222221000',
  '01222222221000',
  '01222222221000',
  '00122222100000',
  '00122222100000',
  '00104400441000',
  '00100440044000'
];

const ARCHER_PALETTE = {
  '1': PAL.archerDk,
  '2': PAL.archer,
  'E': '#80c0ff',
  '4': PAL.heroBoots,
  'B': '#8a5a30'
};
const ARCHER_0 = [
  '00111111110000',
  '01112222211000',
  '01122E22E21000',
  '01122222221000',
  '01112222211B00',
  '00111111110B00',
  '00122222210B00',
  '01222222221B00',
  '01222222221000',
  '01222222221000',
  '00122222100000',
  '00122222100000',
  '00144004410000',
  '00144004410000'
];
const ARCHER_1 = ARCHER_0;

const MAGE_PALETTE = {
  '1': PAL.mageDk,
  '2': PAL.mage,
  'E': PAL.mageGlow,
  '4': PAL.heroBoots,
  'G': PAL.mageGlow
};
const MAGE_0 = [
  '00011111100000',
  '00111111110000',
  '01112222211000',
  '01122E22E21000',
  '01122222221000',
  '00112222110000',
  '00111111110000',
  '00122222210000',
  '01222G2G221000',
  '01222222221000',
  '01222222221000',
  '00122222100000',
  '00100440010000',
  '00100440010000'
];
const MAGE_1 = [
  '00011111100000',
  '00111111110000',
  '01112222211000',
  '01122E22E21000',
  '01122222221000',
  '00112222110000',
  '00111111110000',
  '00122222210000',
  '01222GGGG21000',
  '01222222221000',
  '01222222221000',
  '00122222100000',
  '00100440010000',
  '00010040100000'
];

const ENEMY_SPRITES = {
  grunt:  { frames: [GRUNT_0, GRUNT_1],   palette: GRUNT_PALETTE,  maxHp: 30,  speed: 1.0, damage: 8,  xp: 5,  bloodDrop: [2, 5] },
  archer: { frames: [ARCHER_0, ARCHER_1], palette: ARCHER_PALETTE, maxHp: 22,  speed: 1.2, damage: 10, xp: 7,  bloodDrop: [3, 6], ranged: true, attackRange: 180 },
  mage:   { frames: [MAGE_0, MAGE_1],     palette: MAGE_PALETTE,   maxHp: 26,  speed: 0.8, damage: 12, xp: 8,  bloodDrop: [4, 8], ranged: true, attackRange: 220 }
};

/**
 * Draws an enemy sprite.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type - key in ENEMY_SPRITES
 * @param {number} frameIndex
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {boolean} flipX
 */
function drawEnemySprite(ctx, type, frameIndex, x, y, size, flipX = false) {
  if (window.Assets && window.Assets.hasImage('enemy_' + type)) {
    const img = window.Assets.getImage('enemy_' + type);
    const frameSize = 64;
    const framesPerRow = Math.floor(img.width / frameSize);
    const col = frameIndex % Math.max(1, framesPerRow);

    ctx.save();
    if (flipX) {
      ctx.translate(x + size, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, col * frameSize, 0, frameSize, frameSize, 0, 0, size, size);
    } else {
      ctx.drawImage(img, col * frameSize, 0, frameSize, frameSize, x, y, size, size);
    }
    ctx.restore();
    return;
  }

  const sprite = ENEMY_SPRITES[type] || ENEMY_SPRITES.grunt;
  const map = sprite.frames[frameIndex % sprite.frames.length];
  const cols = map[0].length;
  const px = size / cols;
  drawPixelMap(ctx, map, sprite.palette, x, y, px, flipX);
}

/* ══════════════════════════════════════════════════════════════
   TILE RENDERING
   Each tile type drawn procedurally with subtle texture variation
══════════════════════════════════════════════════════════════ */
function drawTile(ctx, type, x, y, size, variant = 0) {
  switch (type) {
    case 'floor_stone':
      ctx.fillStyle = PAL.floorStone;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.floorStoneLt;
      if (variant % 2 === 0) {
        ctx.fillRect(x + size * 0.1, y + size * 0.1, size * 0.35, size * 0.35);
        ctx.fillRect(x + size * 0.55, y + size * 0.55, size * 0.35, size * 0.35);
      } else {
        ctx.fillRect(x + size * 0.55, y + size * 0.1, size * 0.35, size * 0.35);
        ctx.fillRect(x + size * 0.1, y + size * 0.55, size * 0.35, size * 0.35);
      }
      break;

    case 'floor_dirt':
      ctx.fillStyle = PAL.floorDirt;
      ctx.fillRect(x, y, size, size);
      if (variant % 3 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.fillRect(x + size * 0.2, y + size * 0.3, size * 0.15, size * 0.15);
        ctx.fillRect(x + size * 0.6, y + size * 0.5, size * 0.12, size * 0.12);
      }
      break;

    case 'floor_grass':
      ctx.fillStyle = PAL.floorGrass;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.floorGrassLt;
      if (variant % 4 === 0) {
        ctx.fillRect(x + size * 0.3, y + size * 0.2, size * 0.08, size * 0.3);
        ctx.fillRect(x + size * 0.6, y + size * 0.5, size * 0.08, size * 0.3);
      } else if (variant % 4 === 1) {
        ctx.fillRect(x + size * 0.15, y + size * 0.6, size * 0.08, size * 0.25);
      }
      break;

    case 'wall':
      ctx.fillStyle = PAL.wallStone;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.wallStoneLt;
      ctx.fillRect(x + size * 0.05, y + size * 0.05, size * 0.9, size * 0.15);
      ctx.fillStyle = PAL.wallEdge;
      ctx.fillRect(x, y + size - size * 0.08, size, size * 0.08);
      break;

    case 'water':
      ctx.fillStyle = PAL.water;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.waterLt;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x, y + size * (0.3 + 0.1 * Math.sin(variant)), size, size * 0.15);
      ctx.globalAlpha = 1;
      break;

    case 'lava':
      ctx.fillStyle = PAL.lava;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.lavaGlow;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(variant * 0.5);
      ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
      ctx.globalAlpha = 1;
      break;

    case 'blood_pool':
      ctx.fillStyle = PAL.floorStone;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.bloodPool;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(x + size/2, y + size/2, size*0.4, size*0.3, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;

    case 'door':
      ctx.fillStyle = PAL.wallStone;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.doorWood;
      ctx.fillRect(x + size * 0.15, y, size * 0.7, size);
      ctx.fillStyle = PAL.chestGold;
      ctx.fillRect(x + size * 0.42, y + size * 0.45, size * 0.16, size * 0.16);
      break;

    case 'chest':
      ctx.fillStyle = PAL.floorStone;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = PAL.chestWood;
      ctx.fillRect(x + size * 0.15, y + size * 0.35, size * 0.7, size * 0.5);
      ctx.fillStyle = PAL.chestGold;
      ctx.fillRect(x + size * 0.15, y + size * 0.45, size * 0.7, size * 0.08);
      ctx.fillRect(x + size * 0.45, y + size * 0.5, size * 0.1, size * 0.15);
      break;

    default:
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, size, size);
  }
}

/* ══════════════════════════════════════════════════════════════
   ANIMATION CONTROLLER
   Tracks frame timing for any sprite (player/enemy)
══════════════════════════════════════════════════════════════ */
class AnimationController {
  constructor(frameCount = 2, frameDuration = 200) {
    this.frameCount = frameCount;
    this.frameDuration = frameDuration;
    this.currentFrame = 0;
    this.elapsed = 0;
  }

  update(dt, isMoving) {
    if (!isMoving) {
      this.currentFrame = 0;
      this.elapsed = 0;
      return;
    }
    this.elapsed += dt;
    if (this.elapsed >= this.frameDuration) {
      this.elapsed = 0;
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
    }
  }

  reset() {
    this.currentFrame = 0;
    this.elapsed = 0;
  }
}

/* ══════════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════════ */
window.Sprites = {
  TILE_SIZE,
  PAL,
  drawPixelMap,
  drawPlayerSprite,
  drawEnemySprite,
  drawTile,
  ENEMY_SPRITES,
  AnimationController
};