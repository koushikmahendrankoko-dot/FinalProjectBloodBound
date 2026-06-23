/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — map.js
   Tile maps for all 5 chapters, collision detection,
   room/zone transitions, minimap rendering, object spawning
═══════════════════════════════════════════════════════════════ */

const T = {
  VOID:  0,
  FLOOR: 1,  // stone floor
  DIRT:  2,  // dirt floor
  GRASS: 3,  // grass floor
  WALL:  4,  // solid wall
  WATER: 5,  // water (slows)
  LAVA:  6,  // lava (damages)
  BLOOD: 7,  // blood pool (aesthetic)
  DOOR:  8,  // locked/open door
  CHEST: 9,  // loot chest
  STAIR: 10  // exit / next area
};

/* ══════════════════════════════════════════════════════════════
   CHAPTER MAP DEFINITIONS
   Each chapter has a tile grid (W x H), spawn points,
   enemy spawns, chest locations, and exit point.
══════════════════════════════════════════════════════════════ */

/* Helper: generate a flat map of given dimensions filled with a value */
function makeMap(w, h, fill = T.VOID) {
  return Array.from({ length: h }, () => new Array(w).fill(fill));
}

/* ── CHAPTER 1: The Cursed Village (outdoor, grass + ruins) ── */
function buildChapter1() {
  const W = 40, H = 30;
  const grid = makeMap(W, H, T.VOID);

  // Outer wall border
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W-1 || y === 0 || y === H-1) {
        grid[y][x] = T.WALL;
      } else {
        grid[y][x] = T.GRASS;
      }
    }
  }

  // Village ruins — stone floors in patches
  const stoneAreas = [
    [8, 5, 10, 8], [20, 4, 8, 6], [28, 10, 7, 5],
    [5, 15, 12, 8], [22, 16, 10, 8], [14, 22, 12, 5]
  ];
  stoneAreas.forEach(([x, y, w, h]) => {
    for (let ty = y; ty < y+h; ty++) {
      for (let tx = x; tx < x+w; tx++) {
        if (ty > 0 && ty < H-1 && tx > 0 && tx < W-1) {
          grid[ty][tx] = T.FLOOR;
        }
      }
    }
  });

  // Village walls (ruins)
  const walls = [
    [8,5],[9,5],[10,5],[11,5],[17,5],[18,5],
    [8,12],[9,12],[10,12],[11,12],[12,12],
    [20,4],[21,4],[22,4],[27,4],
    [5,15],[5,16],[5,17],[5,22],[16,22],
    [22,16],[31,16],[22,23],[31,23]
  ];
  walls.forEach(([x, y]) => { if (grid[y] && grid[y][x] !== undefined) grid[y][x] = T.WALL; });

  // Blood pools near ruins
  [[14,9],[25,12],[10,19],[26,20]].forEach(([x,y]) => { grid[y][x] = T.BLOOD; });

  // Water stream
  for (let x = 15; x < 22; x++) { grid[2][x] = T.WATER; grid[3][x] = T.WATER; }

  // Chest and staircase (exit to dungeon = chapter 2)
  grid[7][15] = T.CHEST;
  grid[27][20] = T.STAIR;

  return {
    grid, W, H,
    tileType: 'grass',
    playerStart: { x: 5, y: 5 },
    exits: [{ x: 27, y: 20, toChapter: 2 }],
    enemies: [
      { type: 'grunt', tx: 12, ty: 8  },
      { type: 'grunt', tx: 25, ty: 7  },
      { type: 'grunt', tx: 30, ty: 14 },
      { type: 'archer',tx: 26, ty: 19 },
      { type: 'grunt', tx: 8,  ty: 20 },
      { type: 'grunt', tx: 18, ty: 24 }
    ],
    chests: [{ tx: 15, ty: 7, loot: { bloodCoins: 15, potions: 1 } }],
    boss: null,
    checkpointId: 'ch1_start',
    music: 'chapter1',
    ambientLight: '#1a0308'
  };
}

/* ── CHAPTER 2: The Hollow Dungeon ── */
function buildChapter2() {
  const W = 44, H = 36;
  const grid = makeMap(W, H, T.VOID);

  // Dungeon rooms connected by corridors
  const rooms = [
    [2, 2, 12, 10],   // entrance room
    [16, 2, 10, 8],   // side room A
    [28, 2, 12, 10],  // side room B
    [2, 14, 14, 10],  // mid room A
    [20, 14, 12, 10], // mid room B (boss antechamber)
    [34, 14, 8, 10],  // secret room
    [4, 26, 16, 8],   // lower room A
    [24, 26, 14, 8]   // final room (boss)
  ];

  // Fill rooms with stone floor
  rooms.forEach(([rx, ry, rw, rh]) => {
    for (let y = ry; y < ry+rh; y++) {
      for (let x = rx; x < rx+rw; x++) {
        if (y > 0 && y < H-1 && x > 0 && x < W-1) {
          grid[y][x] = T.FLOOR;
        }
      }
    }
  });

  // Walls around rooms (border)
  rooms.forEach(([rx, ry, rw, rh]) => {
    for (let y = ry-1; y <= ry+rh; y++) {
      for (let x = rx-1; x <= rx+rw; x++) {
        if (y >= 0 && y < H && x >= 0 && x < W) {
          if (grid[y][x] === T.VOID) grid[y][x] = T.WALL;
        }
      }
    }
  });

  // Corridors
  const corridors = [
    [14, 5, 16, 5],   // room1 -> room2
    [26, 5, 28, 5],   // room2 -> room3
    [8, 12, 8, 14],   // room1 -> mid1
    [24, 10, 24, 14], // room2 -> mid2
    [36, 10, 36, 14], // room3 -> secret
    [16, 18, 20, 18], // mid1 -> mid2
    [32, 18, 34, 18], // mid2 -> secret
    [10, 24, 10, 26], // mid1 -> lower1
    [28, 24, 28, 26]  // mid2 -> boss room
  ];
  corridors.forEach(([x1, y1, x2, y2]) => {
    if (x1 === x2) {
      for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++) {
        grid[y][x1] = T.FLOOR;
        if (grid[y][x1-1] === T.VOID) grid[y][x1-1] = T.WALL;
        if (grid[y][x1+1] === T.VOID) grid[y][x1+1] = T.WALL;
      }
    } else {
      for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++) {
        grid[y1][x] = T.FLOOR;
        if (grid[y1-1] && grid[y1-1][x] === T.VOID) grid[y1-1][x] = T.WALL;
        if (grid[y1+1] && grid[y1+1][x] === T.VOID) grid[y1+1][x] = T.WALL;
      }
    }
  });

  // Lava traps
  [[17,19],[18,19],[19,19]].forEach(([x,y]) => { grid[y][x] = T.LAVA; });
  [[25,28],[26,28]].forEach(([x,y]) => { grid[y][x] = T.LAVA; });

  // Blood pools
  [[5,5],[10,5],[30,5],[6,18],[22,18]].forEach(([x,y]) => { grid[y][x] = T.BLOOD; });

  // Doors separating key areas
  grid[18][16] = T.DOOR;
  grid[18][32] = T.DOOR;

  // Chests
  grid[3][39] = T.CHEST;
  grid[27][5]  = T.CHEST;

  // Boss room staircase exit
  grid[33][30] = T.STAIR;

  return {
    grid, W, H,
    tileType: 'stone',
    playerStart: { x: 4, y: 4 },
    exits: [{ x: 30, y: 33, toChapter: 3 }],
    enemies: [
      { type: 'grunt',  tx: 10, ty: 6  },
      { type: 'grunt',  tx: 20, ty: 5  },
      { type: 'archer', tx: 30, ty: 6  },
      { type: 'grunt',  tx: 6,  ty: 18 },
      { type: 'mage',   tx: 24, ty: 18 },
      { type: 'grunt',  tx: 8,  ty: 28 },
      { type: 'archer', tx: 32, ty: 28 },
      { type: 'mage',   tx: 28, ty: 30 }
    ],
    chests: [
      { tx: 39, ty: 3,  loot: { bloodCoins: 25, potions: 1 } },
      { tx: 5,  ty: 27, loot: { bloodCoins: 20 } }
    ],
    boss: { type: 'hollow_beast', tx: 30, ty: 30 },
    checkpointId: 'ch2_start',
    music: 'chapter2',
    ambientLight: '#0a0005'
  };
}

/* ── CHAPTER 3: The Crimson Castle ── */
function buildChapter3() {
  const W = 48, H = 40;
  const grid = makeMap(W, H, T.VOID);

  // Castle layout — large rooms connected by narrow corridors
  const rooms = [
    [2, 2, 14, 12],   // gatehouse
    [18, 2, 12, 8],   // guard room
    [32, 2, 14, 12],  // barracks
    [2, 16, 10, 14],  // dungeon cells
    [14, 16, 20, 10], // great hall
    [36, 16, 10, 12], // armory
    [8, 32, 14, 6],   // treasury
    [26, 32, 20, 6]   // throne room (boss)
  ];

  rooms.forEach(([rx, ry, rw, rh]) => {
    for (let y = ry; y < ry+rh; y++) {
      for (let x = rx; x < rx+rw; x++) {
        if (y > 0 && y < H-1 && x > 0 && x < W-1) grid[y][x] = T.FLOOR;
      }
    }
    for (let y = ry-1; y <= ry+rh; y++) {
      for (let x = rx-1; x <= rx+rw; x++) {
        if (y >= 0 && y < H && x >= 0 && x < W && grid[y][x] === T.VOID) grid[y][x] = T.WALL;
      }
    }
  });

  // Corridors
  [[16,6,18,6],[30,6,32,6],[10,14,10,16],[24,10,24,16],[40,14,40,16],
   [14,22,14,16],[34,22,36,22],[14,30,14,32],[36,30,36,32]]
  .forEach(([x1,y1,x2,y2]) => {
    if (x1 === x2) {
      for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++) {
        grid[y][x1] = T.FLOOR;
        if (grid[y][x1-1] === T.VOID) grid[y][x1-1] = T.WALL;
        if (grid[y][x1+1] === T.VOID) grid[y][x1+1] = T.WALL;
      }
    } else {
      for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++) {
        grid[y1][x] = T.FLOOR;
        if (grid[y1-1]?.[x] === T.VOID) grid[y1-1][x] = T.WALL;
        if (grid[y1+1]?.[x] === T.VOID) grid[y1+1][x] = T.WALL;
      }
    }
  });

  // Blood pools in dungeon cells
  [[3,18],[3,22],[3,26],[4,18],[4,22],[4,26]].forEach(([x,y]) => { grid[y][x] = T.BLOOD; });

  // Doors
  grid[6][16] = T.DOOR; grid[6][30] = T.DOOR;
  grid[22][14] = T.DOOR; grid[30][26] = T.DOOR;

  // Chests
  grid[3][44] = T.CHEST; grid[35][3] = T.CHEST; grid[35][36] = T.CHEST;

  // Boss room / exit
  grid[37][44] = T.STAIR;

  return {
    grid, W, H,
    tileType: 'stone',
    playerStart: { x: 4, y: 4 },
    exits: [{ x: 44, y: 37, toChapter: 4 }],
    enemies: [
      { type: 'grunt',  tx: 10, ty: 5  },
      { type: 'grunt',  tx: 20, ty: 5  },
      { type: 'archer', tx: 36, ty: 6  },
      { type: 'grunt',  tx: 4,  ty: 20 },
      { type: 'grunt',  tx: 4,  ty: 24 },
      { type: 'mage',   tx: 22, ty: 20 },
      { type: 'archer', tx: 38, ty: 20 },
      { type: 'grunt',  tx: 14, ty: 34 },
      { type: 'mage',   tx: 30, ty: 34 },
      { type: 'archer', tx: 40, ty: 34 }
    ],
    chests: [
      { tx: 44, ty: 3,  loot: { bloodCoins: 40, potions: 1 } },
      { tx: 3,  ty: 35, loot: { bloodCoins: 30 } },
      { tx: 35, ty: 36, loot: { bloodCoins: 50, potions: 2 } }
    ],
    boss: { type: 'lord_vael', tx: 40, ty: 36 },
    checkpointId: 'ch3_start',
    music: 'chapter3',
    ambientLight: '#0d0005'
  };
}

/* ── CHAPTER 4 & 5: Blood Temple + Final Realm (condensed) ── */
function buildChapter4() {
  const W = 42, H = 38;
  const grid = makeMap(W, H, T.VOID);

  // Temple — symmetrical cross-shaped layout with blood pools
  const rooms = [
    [16, 2, 10, 8],   // north shrine
    [2, 14, 10, 10],  // west shrine
    [30, 14, 10, 10], // east shrine
    [16, 14, 10, 10], // central chamber
    [16, 28, 10, 8]   // south – boss antechamber
  ];

  rooms.forEach(([rx, ry, rw, rh]) => {
    for (let y = ry; y < ry+rh; y++) {
      for (let x = rx; x < rx+rw; x++) {
        if (y > 0 && y < H-1 && x > 0 && x < W-1) grid[y][x] = T.FLOOR;
      }
    }
    for (let y = ry-1; y <= ry+rh; y++) {
      for (let x = rx-1; x <= rx+rw; x++) {
        if (y >= 0 && y < H && x >= 0 && x < W && grid[y][x] === T.VOID) grid[y][x] = T.WALL;
      }
    }
  });

  // Cross corridors
  [[21,10,21,14],[21,24,21,28],[12,18,16,18],[26,18,30,18]].forEach(([x1,y1,x2,y2]) => {
    if (x1===x2) {
      for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++) {
        grid[y][x1] = T.FLOOR;
        if (grid[y][x1-1]===T.VOID) grid[y][x1-1]=T.WALL;
        if (grid[y][x1+1]===T.VOID) grid[y][x1+1]=T.WALL;
      }
    } else {
      for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++) {
        grid[y1][x] = T.FLOOR;
        if (grid[y1-1]?.[x]===T.VOID) grid[y1-1][x]=T.WALL;
        if (grid[y1+1]?.[x]===T.VOID) grid[y1+1][x]=T.WALL;
      }
    }
  });

  // Blood pool decorations — lots of them
  const bps = [[18,15],[19,15],[20,15],[21,15],[22,15],[18,22],[22,22],[20,18]];
  bps.forEach(([x,y]) => { grid[y][x] = T.BLOOD; });

  // Lava around shrines
  [[17,3],[18,3],[19,3],[20,3],[3,17],[3,18],[3,19],[37,17],[37,18],[37,19]].forEach(([x,y])=>{ grid[y][x]=T.LAVA; });

  // Obelisks as chests (interact = activate)
  grid[5][20] = T.CHEST;  // north obelisk
  grid[19][4] = T.CHEST;  // west obelisk
  grid[19][37] = T.CHEST; // east obelisk
  grid[33][20] = T.CHEST; // south obelisk

  grid[36][21] = T.STAIR;

  return {
    grid, W, H,
    tileType: 'stone',
    playerStart: { x: 20, y: 6 },
    exits: [{ x: 21, y: 36, toChapter: 5 }],
    enemies: [
      { type: 'mage',   tx: 18, ty: 16 }, { type: 'mage',   tx: 22, ty: 16 },
      { type: 'archer', tx: 5,  ty: 18 }, { type: 'mage',   tx: 5,  ty: 20 },
      { type: 'archer', tx: 35, ty: 18 }, { type: 'mage',   tx: 35, ty: 20 },
      { type: 'grunt',  tx: 18, ty: 30 }, { type: 'grunt',  tx: 22, ty: 30 }
    ],
    chests: [
      { tx: 20, ty: 5,  loot: { bloodCoins: 30 }, obelisk: 'north' },
      { tx: 4,  ty: 19, loot: { bloodCoins: 30 }, obelisk: 'west' },
      { tx: 37, ty: 19, loot: { bloodCoins: 30 }, obelisk: 'east' },
      { tx: 20, ty: 33, loot: { bloodCoins: 30 }, obelisk: 'south' }
    ],
    boss: { type: 'blood_guardians', tx: 20, ty: 32 },
    checkpointId: 'ch4_start',
    music: 'boss',
    ambientLight: '#0d0002'
  };
}

function buildChapter5() {
  const W = 40, H = 36;
  const grid = makeMap(W, H, T.VOID);

  // Final realm — cracked void-like arena with blood everywhere
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      grid[y][x] = T.FLOOR;
    }
  }
  // Outer walls
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x===0||x===W-1||y===0||y===H-1) grid[y][x] = T.WALL;
    }
  }

  // Blood pools everywhere
  for (let i = 0; i < 40; i++) {
    const bx = 2 + Math.floor(Math.random() * (W-4));
    const by = 2 + Math.floor(Math.random() * (H-4));
    grid[by][bx] = T.BLOOD;
  }

  // Lava ring around the center (arena stage boundary)
  for (let x = 10; x < 30; x++) { grid[4][x] = T.LAVA; grid[31][x] = T.LAVA; }
  for (let y = 4; y < 32; y++)  { grid[y][10] = T.LAVA; grid[y][29] = T.LAVA; }

  // No exit — game ends when boss is defeated

  return {
    grid, W, H,
    tileType: 'stone',
    playerStart: { x: 20, y: 28 },
    exits: [],
    enemies: [],
    chests: [],
    boss: { type: 'blood_god', tx: 20, ty: 10 },
    checkpointId: 'ch5_start',
    music: 'boss',
    ambientLight: '#0a0000',
    isFinalChapter: true
  };
}

/* ══════════════════════════════════════════════════════════════
   MAP MANAGER
══════════════════════════════════════════════════════════════ */
class MapManager {
  constructor() {
    this.currentChapter = 1;
    this.data = null;
    this.animTick = 0; // for animated tiles (water/lava)
    this.openedChests = new Set();
    this.openedDoors  = new Set();
  }

  load(chapter) {
    this.currentChapter = chapter;
    this.openedChests = new Set();
    this.openedDoors  = new Set();

    const builders = {
      1: buildChapter1,
      2: buildChapter2,
      3: buildChapter3,
      4: buildChapter4,
      5: buildChapter5
    };
    this.data = (builders[chapter] || buildChapter1)();
    return this.data;
  }

  get worldWidth()  { return this.data ? this.data.W * Sprites.TILE_SIZE : 0; }
  get worldHeight() { return this.data ? this.data.H * Sprites.TILE_SIZE : 0; }

  /* Check if a world pixel position is a solid tile */
  isSolid(wx, wy) {
    if (!this.data) return true;
    const tx = Math.floor(wx / Sprites.TILE_SIZE);
    const ty = Math.floor(wy / Sprites.TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.data.W || ty >= this.data.H) return true;
    const tile = this.data.grid[ty][tx];
    // Closed doors and water/lava are solid for movement
    if (tile === T.WALL || tile === T.VOID) return true;
    if (tile === T.DOOR && !this.openedDoors.has(`${tx},${ty}`)) return true;
    return false;
  }

  /* Get the tile type at a world position */
  tileAt(wx, wy) {
    if (!this.data) return T.VOID;
    const tx = Math.floor(wx / Sprites.TILE_SIZE);
    const ty = Math.floor(wy / Sprites.TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.data.W || ty >= this.data.H) return T.VOID;
    return this.data.grid[ty][tx];
  }

  /* Check if a world-space rectangle collides with any solid tile */
  rectSolid(x, y, w, h) {
    const margin = 2;
    const points = [
      [x + margin,   y + margin],
      [x + w - margin, y + margin],
      [x + margin,   y + h - margin],
      [x + w - margin, y + h - margin]
    ];
    return points.some(([px, py]) => this.isSolid(px, py));
  }

  /* Open a door at tile position */
  openDoor(tx, ty) {
    this.openedDoors.add(`${tx},${ty}`);
  }

  /* Open a chest at tile position — returns loot */
  openChest(tx, ty) {
    const key = `${tx},${ty}`;
    if (this.openedChests.has(key)) return null;
    this.openedChests.add(key);
    const chest = this.data.chests?.find(c => c.tx === tx && c.ty === ty);
    return chest ? chest.loot : { bloodCoins: 10 };
  }

  /* Check for exit/stair at world position */
  getExitAt(wx, wy) {
    if (!this.data) return null;
    const tx = Math.floor(wx / Sprites.TILE_SIZE);
    const ty = Math.floor(wy / Sprites.TILE_SIZE);
    if (this.data.grid[ty]?.[tx] !== T.STAIR) return null;
    return this.data.exits?.find(e => e.x === tx && e.y === ty) || null;
  }

  /* Render parallax background layers (real images, if provided) behind tiles */
  renderBackground(ctx, camera) {
    if (!window.Assets) return;
    const layers = window.Assets.getParallaxLayers(this.currentChapter);
    if (layers.length === 0) return;

    const depthSpeed = { far: 0.2, mid: 0.5, near: 0.8, bg: 0.3 };

    for (const { key, layer } of layers) {
      const img = window.Assets.getImage(key);
      if (!img) continue;
      const speed = depthSpeed[layer] ?? 0.4;

      // Scale image to cover camera height, tile horizontally for seamless scroll
      const scale = camera.height / img.height;
      const drawW = img.width * scale;
      const drawH = camera.height;

      const offsetX = -(camera.x * speed) % drawW;
      let startX = offsetX - drawW;
      while (startX < camera.width) {
        ctx.drawImage(img, startX, 0, drawW, drawH);
        startX += drawW;
      }
    }
  }

  update(dt) {
    this.animTick += dt;
  }

  /* Render all visible tiles */
  render(ctx, camera) {
    if (!this.data) return;
    const { grid, W, H } = this.data;
    const ts = Sprites.TILE_SIZE;

    const startX = Math.max(0, Math.floor(camera.x / ts) - 1);
    const startY = Math.max(0, Math.floor(camera.y / ts) - 1);
    const endX   = Math.min(W, Math.ceil((camera.x + camera.width)  / ts) + 1);
    const endY   = Math.min(H, Math.ceil((camera.y + camera.height) / ts) + 1);

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const tile = grid[ty][tx];
        if (tile === T.VOID) continue;

        const wx = tx * ts;
        const wy = ty * ts;
        const variant = (tx * 7 + ty * 13) % 16;

        // Draw background for lava/water even under overlay
        const tileTypeStr = this._tileKey(tile, tx, ty);
        Sprites.drawTile(ctx, tileTypeStr, wx, wy, ts,
          tile === T.WATER ? this.animTick * 0.001 : variant);

        // Stair glow
        if (tile === T.STAIR) {
          ctx.fillStyle = `rgba(255,200,50,${0.3 + 0.2 * Math.sin(this.animTick * 0.003)})`;
          ctx.beginPath();
          ctx.arc(wx + ts/2, wy + ts/2, ts * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Chest sparkle
        if (tile === T.CHEST) {
          const key = `${tx},${ty}`;
          if (!this.openedChests.has(key)) {
            ctx.fillStyle = `rgba(200,160,20,${0.4 + 0.3 * Math.sin(this.animTick * 0.004)})`;
            ctx.beginPath();
            ctx.arc(wx + ts/2, wy + ts/4, ts * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  _tileKey(tile, tx, ty) {
    switch (tile) {
      case T.FLOOR: return this.data.tileType === 'grass' ? 'floor_grass' : 'floor_stone';
      case T.DIRT:  return 'floor_dirt';
      case T.GRASS: return 'floor_grass';
      case T.WALL:  return 'wall';
      case T.WATER: return 'water';
      case T.LAVA:  return 'lava';
      case T.BLOOD: return 'blood_pool';
      case T.DOOR:  return this.openedDoors.has(`${tx},${ty}`) ? 'floor_stone' : 'door';
      case T.CHEST: return 'chest';
      case T.STAIR: return 'floor_stone';
      default: return 'floor_stone';
    }
  }

  /* Draw minimap onto minimap canvas */
  renderMinimap(minimapCtx, playerWx, playerWy) {
    if (!this.data) return;
    const { grid, W, H } = this.data;
    const mw = minimapCtx.canvas.width;
    const mh = minimapCtx.canvas.height;
    const cw = mw / W;
    const ch = mh / H;

    minimapCtx.fillStyle = '#0a0000';
    minimapCtx.fillRect(0, 0, mw, mh);

    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const tile = grid[ty][tx];
        if (tile === T.VOID) continue;

        let color = '#2a1a18';
        if (tile === T.WALL) color = '#1a0c0c';
        else if (tile === T.WATER) color = '#1a3a50';
        else if (tile === T.LAVA)  color = '#a02010';
        else if (tile === T.BLOOD) color = '#4a0008';
        else if (tile === T.STAIR) color = '#ffcc02';
        else if (tile === T.CHEST) color = '#c8a020';

        minimapCtx.fillStyle = color;
        minimapCtx.fillRect(Math.floor(tx * cw), Math.floor(ty * ch), Math.max(1, Math.ceil(cw)), Math.max(1, Math.ceil(ch)));
      }
    }

    // Player dot
    const px = (playerWx / Sprites.TILE_SIZE) * cw;
    const py = (playerWy / Sprites.TILE_SIZE) * ch;
    minimapCtx.fillStyle = '#ff3347';
    minimapCtx.fillRect(Math.round(px - 1), Math.round(py - 1), 3, 3);
  }
}

window.MapManager = MapManager;
window.TileTypes = T;