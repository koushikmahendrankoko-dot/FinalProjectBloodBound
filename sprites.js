/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — sprites.js (v3)
   Redesigned pixel-art sprite system. Hero looks genuinely cool —
   taller, more detailed, armoured blood-rune warrior silhouette.
   All 5 bosses have unique hand-crafted pixel art.
   Real PNG assets slot in automatically if provided.
═══════════════════════════════════════════════════════════════ */

const TILE_SIZE = 32;

const PAL = {
  // ── Player — armoured blood-rune warrior ──
  pArmor:   '#1c0810',  // deep chest plate
  pArmorLt: '#2e1020',  // armour highlight
  pArmorGl: '#5c1830',  // armour glow edge
  pCloak:   '#0d0205',  // back cloak
  pCloakLt: '#1a0510',  // cloak inner fold
  pSkin:    '#c09070',  // face / hands
  pEye:     '#ff4455',  // glowing eye slit
  pRune:    '#ff3347',  // blood rune
  pRuneGl:  '#ff8090',  // rune glow
  pBelt:    '#4a0e18',  // waist guard
  pBoots:   '#0a0000',  // boots
  pBlade:   '#c8d0e0',  // blood blade (basic attack projectile)
  pBladeGl: '#ff6070',  // blade energy
  pShoulder:'#3a1020',  // shoulder plate
  // ── Enemies ──
  grunt:    '#3a1818',
  gruntLt:  '#5a2828',
  gruntEye: '#ff5060',
  archer:   '#283040',
  archerLt: '#384858',
  archerBow:'#6a4020',
  mage:     '#3a1850',
  mageLt:   '#5a2870',
  mageGl:   '#c060ff',
  // ── Boss palette keys ──
  bRed:     '#8b1a24',
  bRedLt:   '#b52030',
  bGold:    '#ffcc02',
  bGoldLt:  '#ffe070',
  bDark:    '#0d0205',
  bSilver:  '#a0b0c0',
  bPurple:  '#6020a0',
  bPurpleLt:'#9040d0',
  bGreen:   '#204820',
  bGreenLt: '#40a040',
  bVoid:    '#080010',
  // ── Tiles ──
  floorA:   '#1e1010',
  floorAlt: '#2a1818',
  floorGrass:'#182010',
  floorGrAlt:'#223018',
  wall:     '#0e0808',
  wallLt:   '#1c1010',
  wallEdge: '#060203',
  water:    '#081828',
  waterLt:  '#103040',
  lava:     '#901808',
  lavaGl:   '#ff5010',
  blood:    '#3a0006',
  chest:    '#3a1e08',
  chestGld: '#c89018',
  door:     '#2a1206',
  torch:    '#ff7818',
};

/* ══════════════════════════════════════════════════════════════
   PIXEL MAP RENDERER
══════════════════════════════════════════════════════════════ */
function drawPixelMap(ctx, map, colorMap, x, y, px, flipX=false, glowKeys=null) {
  const rows=map.length, cols=map[0].length;
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const key=map[r][c];
      if (key==='0'||key==='.'||!colorMap[key]) continue;
      const color=colorMap[key];
      const dc=flipX?cols-1-c:c;
      if (glowKeys&&glowKeys.includes(key)) {
        ctx.shadowColor=color; ctx.shadowBlur=px*3;
      } else { ctx.shadowBlur=0; }
      ctx.fillStyle=color;
      ctx.fillRect(Math.round(x+dc*px),Math.round(y+r*px),Math.ceil(px)+1,Math.ceil(px)+1);
    }
  }
  ctx.shadowBlur=0;
}

/* ══════════════════════════════════════════════════════════════
   PLAYER SPRITE — The Cursed One (v3 redesign)
   20 cols × 24 rows — taller, armoured, more imposing
   Key: 1=cloak 2=armour 3=armourLt 4=skin 5=eye 6=rune 7=runeGl
        8=belt 9=boots A=shoulder B=cloakLt
══════════════════════════════════════════════════════════════ */
const PMAP = {
  '1':PAL.pCloak, '2':PAL.pArmor, '3':PAL.pArmorLt,
  '4':PAL.pSkin,  '5':PAL.pEye,   '6':PAL.pRune,
  '7':PAL.pRuneGl,'8':PAL.pBelt,  '9':PAL.pBoots,
  'A':PAL.pShoulder,'B':PAL.pCloakLt,'W':PAL.pBlade,'G':PAL.pBladeGl
};

// Down-facing (front), frame 0
const PD0=[
  '00001111111100000000',
  '00011111111110000000',
  '00111111111111000000',
  '00111A22233A11000000',
  '00111A33333A11000000',
  '00111345543A11000000',
  '00111355553111000000',
  '00011133331110000000',
  '00011222222110000000',
  '00111222222211000000',
  '01111222222221100000',
  '01111228828221100000',
  '01111228888221100000',
  '00111122882211000000',
  '00111122882211000000',
  '00011122222110000000',
  '00011122222110000000',
  '00001112222100000000',
  '00001199299100000000',
  '00001199299100000000',
  '00001199299100000000',
  '00000099099000000000',
  '00000099099000000000',
  '00000099099000000000',
];
// Down frame 1 (legs alternate)
const PD1=[
  '00001111111100000000',
  '00011111111110000000',
  '00111111111111000000',
  '00111A22233A11000000',
  '00111A33333A11000000',
  '00111345543A11000000',
  '00111355553111000000',
  '00011133331110000000',
  '00011222222110000000',
  '00111222222211000000',
  '01111222222221100000',
  '01111228828221100000',
  '01111228888221100000',
  '00111122882211000000',
  '00111122882211000000',
  '00011122222110000000',
  '00011122222110000000',
  '00001112222100000000',
  '00001199200000000000',
  '00001199200000000000',
  '00001199200000000000',
  '00000099000000000000',
  '00001000099000000000',
  '00001000099000000000',
];
// Up frame 0
const PU0=[
  '00001111111100000000',
  '00011111111110000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00011111111110000000',
  '00011222222110000000',
  '00111222222211000000',
  '01111A2222A221100000',
  '01111A2228A221100000',
  '01111122882211000000',
  '00111122882211000000',
  '00111122882211000000',
  '00011122222110000000',
  '00011122222110000000',
  '00001112222100000000',
  '00001199299100000000',
  '00001199299100000000',
  '00001199299100000000',
  '00000099099000000000',
  '00000099099000000000',
  '00000099099000000000',
];
const PU1=[
  '00001111111100000000',
  '00011111111110000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00111111111111000000',
  '00011111111110000000',
  '00011222222110000000',
  '00111222222211000000',
  '01111A2222A221100000',
  '01111A2228A221100000',
  '01111122882211000000',
  '00111122882211000000',
  '00111122882211000000',
  '00011122222110000000',
  '00011122222110000000',
  '00001112222100000000',
  '00001199200000000000',
  '00001199200000000000',
  '00001199200000000000',
  '00000099000000000000',
  '00001000099000000000',
  '00001000099000000000',
];
// Side frame 0 (flip for right)
const PS0=[
  '00000111111100000000',
  '00001111111110000000',
  '00011111111111000000',
  '00011A222234110000000',
  '00011A333334110000000',
  '00011134555411000000',
  '00011134555311000000',
  '00001113333110000000',
  '00001122222110000000',
  '00011222222211000000',
  '00111222222A211000000',
  '00111228882A211000000',
  '00111228882A211000000',
  '00011128882111000000',
  '00001122882110000000',
  '00001122222110000000',
  '00001122222110000000',
  '00001112222100000000',
  '00001199999600000000',
  '00001199999600000000',
  '00001199999600000000',
  '00000099990000000000',
  '00000099000000000000',
  '00000099000000000000',
];
const PS1=[
  '00000111111100000000',
  '00001111111110000000',
  '00011111111111000000',
  '00011A222234110000000',
  '00011A333334110000000',
  '00011134555411000000',
  '00011134555311000000',
  '00001113333110000000',
  '00001122222110000000',
  '00011222222211000000',
  '00111222222A211000000',
  '00111228882A211000000',
  '00111228882A211000000',
  '00011128882111000000',
  '00001122882110000000',
  '00001122222110000000',
  '00001122222110000000',
  '00001112222100000000',
  '00001199600000000000',
  '00001199600000000000',
  '00001199600000000000',
  '00000099000000000000',
  '00001000099000000000',
  '00001000099000000000',
];

const PLAYER_FRAMES={
  down:[PD0,PD1], up:[PU0,PU1],
  left:[PS0,PS1], right:[PS0,PS1]
};

function drawPlayerSprite(ctx, direction, frameIndex, x, y, size, isAttacking) {
  if (window.Assets&&window.Assets.hasImage('player_hero')) {
    return drawSpriteSheetFrame(ctx, window.Assets.getImage('player_hero'),
      {direction,frameIndex,isAttacking,x,y,size,frameSize:64,
       rows:{down:0,up:1,left:2,right:2,attackDown:3}});
  }
  const frames=PLAYER_FRAMES[direction]||PLAYER_FRAMES.down;
  const map=frames[frameIndex%frames.length];
  const cols=map[0].length, px=size/cols;
  const flip=direction==='right';
  ctx.save();
  if (isAttacking) { ctx.shadowColor=PAL.pRune; ctx.shadowBlur=10; }
  drawPixelMap(ctx,map,PMAP,x,y,px,flip,['6','7','5']);
  ctx.restore();
}

function drawSpriteSheetFrame(ctx,img,opts) {
  const {direction,frameIndex,isAttacking,x,y,size,frameSize,rows}=opts;
  const rowKey=isAttacking&&rows.attackDown!==undefined?'attackDown':direction;
  const row=rows[rowKey]??0;
  const flip=direction==='right'&&rows.left!==undefined&&rows.right===rows.left;
  const framesPerRow=Math.floor(img.width/frameSize);
  const col=frameIndex%Math.max(1,framesPerRow);
  ctx.save();
  if (flip) {
    ctx.translate(x+size,y); ctx.scale(-1,1);
    ctx.drawImage(img,col*frameSize,row*frameSize,frameSize,frameSize,0,0,size,size);
  } else {
    ctx.drawImage(img,col*frameSize,row*frameSize,frameSize,frameSize,x,y,size,size);
  }
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   ENEMY SPRITES
══════════════════════════════════════════════════════════════ */
const GRUNT_PAL={'1':PAL.grunt,'2':PAL.gruntLt,'E':PAL.gruntEye,'9':PAL.pBoots};
const GRUNT0=[
  '000111111000',
  '001122221100',
  '011122E21110',
  '011122E21110',
  '011122221110',
  '001122221100',
  '001122221100',
  '011122221110',
  '011122221110',
  '011122221110',
  '001122221100',
  '001122221100',
  '001199211000',
  '001199211000',
];
const GRUNT1=[
  '000111111000',
  '001122221100',
  '011122E21110',
  '011122E21110',
  '011122221110',
  '001122221100',
  '001122221100',
  '011122221110',
  '011122221110',
  '011122221110',
  '001122221100',
  '001122221100',
  '001199000000',
  '000001199100',
];

const ARCHER_PAL={'1':PAL.archer,'2':PAL.archerLt,'E':'#80c0ff','9':PAL.pBoots,'B':PAL.archerBow};
const ARCHER0=[
  '000111111000',
  '001122221100',
  '011122E21110',
  '011122E21110',
  '011122221110',
  '001122221100',
  '001122221100',
  '011122221110',
  '011122221110',
  '011122221110',
  '001122221100',
  '001122221100',
  '001199211000',
  '001199211000',
];

const MAGE_PAL={'1':PAL.mage,'2':PAL.mageLt,'E':PAL.mageGl,'9':PAL.pBoots,'G':PAL.mageGl};
const MAGE0=[
  '000111111000',
  '001111111100',
  '011122221110',
  '011122E21110',
  '011122E21110',
  '011122221110',
  '001122221100',
  '001122GG1100',
  '011122GG1110',
  '011122221110',
  '011122221110',
  '001122221100',
  '001199211000',
  '001100199100',
];
const MAGE1=[
  '000111111000',
  '001111111100',
  '011122221110',
  '011122E21110',
  '011122E21110',
  '011122221110',
  '001122221100',
  '001122GGGG00',
  '011122GGGG10',
  '011122221110',
  '011122221110',
  '001122221100',
  '001199000000',
  '000001100199',
];

const ENEMY_SPRITES={
  grunt: {frames:[GRUNT0,GRUNT1],palette:GRUNT_PAL, maxHp:35, speed:1.1, damage:8,  xp:5, bloodDrop:[2,5]},
  archer:{frames:[ARCHER0,ARCHER0],palette:ARCHER_PAL,maxHp:25,speed:1.3,damage:12,xp:7,bloodDrop:[3,6],ranged:true,attackRange:190,kite:true},
  mage:  {frames:[MAGE0,MAGE1],  palette:MAGE_PAL,   maxHp:30, speed:0.9, damage:14, xp:8, bloodDrop:[4,8],ranged:true,attackRange:230,kite:true},
};

function drawEnemySprite(ctx,type,frameIndex,x,y,size,flipX=false) {
  if (window.Assets&&window.Assets.hasImage('enemy_'+type)) {
    const img=window.Assets.getImage('enemy_'+type);
    const frameSize=64, framesPerRow=Math.floor(img.width/frameSize);
    const col=frameIndex%Math.max(1,framesPerRow);
    ctx.save();
    if (flipX) { ctx.translate(x+size,y); ctx.scale(-1,1); ctx.drawImage(img,col*frameSize,0,frameSize,frameSize,0,0,size,size); }
    else ctx.drawImage(img,col*frameSize,0,frameSize,frameSize,x,y,size,size);
    ctx.restore(); return;
  }
  const sprite=ENEMY_SPRITES[type]||ENEMY_SPRITES.grunt;
  const map=sprite.frames[frameIndex%sprite.frames.length];
  const cols=map[0].length, px=size/cols;
  drawPixelMap(ctx,map,sprite.palette,x,y,px,flipX,['E','G']);
}

/* ══════════════════════════════════════════════════════════════
   BOSS SPRITES — all 5 unique hand-crafted
══════════════════════════════════════════════════════════════ */

// Boss 1: Village Guardian — hulking armoured giant
const BOSS1_PAL={'1':PAL.bDark,'2':PAL.bRed,'3':PAL.bRedLt,'F':PAL.torch,'E':'#ff8030','G':PAL.bGold};
const BOSS1_MAP=[
  '000011111111000',
  '000111111111100',
  '001112222211110',
  '001123333321110',
  '001123EE3321110',
  '001123EE3321110',
  '001123333321110',
  '001122222221110',
  '001122FFF221110',
  '001122FFF221110',
  '001122222221110',
  '011122G2G2221100',
  '011122222221100',
  '001122222221100',
  '001122222221100',
  '001111222111100',
  '001111222111100',
];

// Boss 2: Hollow Beast — skeletal monster
const BOSS2_PAL={'1':PAL.bDark,'2':'#3a3a3a','3':'#606060','S':'#c0c0c0','E':PAL.bGold,'R':PAL.pRune};
const BOSS2_MAP=[
  '000001111100000',
  '000111111111000',
  '001113333311100',
  '001133EE33S1100',
  '001133EE33S1100',
  '001133333331100',
  '001132222231100',
  '001132222231100',
  '001132222231100',
  '001132R2R231100',
  '001132222231100',
  '001132222231100',
  '001132222231100',
  '001111222111100',
  '000011222110000',
  '000011222110000',
  '000011222110000',
];

// Boss 3: Lord Vael — tall armoured sorcerer king
const BOSS3_PAL={'1':PAL.bDark,'2':PAL.bSilver,'3':'#d0d8e8','C':'#4060c0','G':PAL.bGold,'E':PAL.bGold,'R':PAL.pRune};
const BOSS3_MAP=[
  '000001GGGGG10000',
  '000011G3GGG11000',
  '000111333331100',
  '001113EEEEE1100',
  '001113E3E3E1100',
  '001113EEEEE1100',
  '001113333331100',
  '001112222221100',
  '001112222221100',
  '001112C2C221100',
  '001112CRCCC1100',
  '001112222221100',
  '001112222221100',
  '001112222221100',
  '001111222111100',
  '000111222111000',
  '000011222110000',
];

// Boss 4: Blood Guardians — elemental crystalline form
const BOSS4_PAL={'1':PAL.bDark,'2':PAL.bPurple,'3':PAL.bPurpleLt,'E':PAL.pRune,'G':PAL.pRuneGl,'C':'#4040ff'};
const BOSS4_MAP=[
  '000000111000000',
  '000001111100000',
  '000011211110000',
  '000113333311000',
  '001113EGGE31100',
  '001113GGGG31100',
  '001113GGGG31100',
  '001113EGGE31100',
  '001113333331100',
  '001112222221100',
  '001112C2C221100',
  '001112222221100',
  '001112222221100',
  '011112222221110',
  '011112222221110',
  '001111222111100',
  '000011222110000',
];

// Boss 5: Blood God — massive cosmic entity
const BOSS5_PAL={'1':PAL.bVoid,'2':PAL.pRune,'3':PAL.pRuneGl,'G':PAL.bGold,'E':'#ff0020','S':'#800010','V':PAL.bVoid};
const BOSS5_MAP=[
  '000001111111000',
  '000011111111100',
  '000111311113100',
  '001113EEEEE3110',
  '001113E3G3E3110',
  '001113EGEGE3110',
  '001113E3G3E3110',
  '001113EEEEE3110',
  '001113333333110',
  '001132222223110',
  '001132222223110',
  '001132E2E2E3110',
  '001132222223110',
  '001132222223110',
  '011132222223111',
  '011133333333111',
  '001111111111100',
];

const BOSS_SPRITE_DATA={
  village_guardian:{map:BOSS1_MAP,palette:BOSS1_PAL,glow:['F','E']},
  hollow_beast:    {map:BOSS2_MAP,palette:BOSS2_PAL,glow:['E','R']},
  lord_vael:       {map:BOSS3_MAP,palette:BOSS3_PAL,glow:['E','G','R']},
  blood_guardians: {map:BOSS4_MAP,palette:BOSS4_PAL,glow:['E','G']},
  blood_god:       {map:BOSS5_MAP,palette:BOSS5_PAL,glow:['2','3','E','G']},
};

function drawBossSprite(ctx,type,x,y,size,isWindingUp) {
  if (window.Assets&&window.Assets.hasImage('boss_'+type)) {
    const img=window.Assets.getImage('boss_'+type);
    const frameSize=128, framesPerRow=Math.floor(img.width/frameSize);
    const col=Math.floor(Date.now()/200)%Math.max(1,framesPerRow);
    ctx.save();
    ctx.shadowColor=PAL.pRune; ctx.shadowBlur=isWindingUp?24:8;
    ctx.drawImage(img,col*frameSize,0,frameSize,frameSize,x,y,size,size);
    ctx.restore(); return;
  }
  const data=BOSS_SPRITE_DATA[type]||BOSS_SPRITE_DATA.village_guardian;
  const cols=data.map[0].length, px=size/cols;
  ctx.save();
  if (isWindingUp) { ctx.shadowColor=PAL.pRune; ctx.shadowBlur=16; }
  drawPixelMap(ctx,data.map,data.palette,x,y,px,false,data.glow);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   TILE RENDERING
══════════════════════════════════════════════════════════════ */
function drawTile(ctx,type,x,y,size,variant=0) {
  switch(type) {
    case 'floor_stone':
      ctx.fillStyle=PAL.floorA; ctx.fillRect(x,y,size,size);
      ctx.fillStyle=PAL.floorAlt;
      if(variant%2===0){ ctx.fillRect(x+size*.1,y+size*.1,size*.35,size*.35); ctx.fillRect(x+size*.55,y+size*.55,size*.35,size*.35); }
      else{ ctx.fillRect(x+size*.55,y+size*.1,size*.35,size*.35); ctx.fillRect(x+size*.1,y+size*.55,size*.35,size*.35); }
      break;
    case 'floor_grass':
      ctx.fillStyle=PAL.floorGrass; ctx.fillRect(x,y,size,size);
      ctx.fillStyle=PAL.floorGrAlt;
      if(variant%3===0) ctx.fillRect(x+size*.3,y+size*.2,size*.06,size*.3);
      break;
    case 'wall':
      ctx.fillStyle=PAL.wall; ctx.fillRect(x,y,size,size);
      ctx.fillStyle=PAL.wallLt; ctx.fillRect(x+size*.05,y+size*.05,size*.9,size*.15);
      ctx.fillStyle=PAL.wallEdge; ctx.fillRect(x,y+size-size*.08,size,size*.08);
      break;
    case 'water':
      ctx.fillStyle=PAL.water; ctx.fillRect(x,y,size,size);
      ctx.globalAlpha=0.35+0.15*Math.sin(variant*0.3+Date.now()*.001);
      ctx.fillStyle=PAL.waterLt; ctx.fillRect(x,y+size*.3,size,size*.15);
      ctx.globalAlpha=1;
      break;
    case 'lava':
      ctx.fillStyle=PAL.lava; ctx.fillRect(x,y,size,size);
      ctx.globalAlpha=0.5+0.3*Math.sin(variant*0.5+Date.now()*.002);
      ctx.fillStyle=PAL.lavaGl; ctx.fillRect(x+size*.2,y+size*.2,size*.6,size*.6);
      ctx.globalAlpha=1;
      break;
    case 'blood_pool':
      ctx.fillStyle=PAL.floorA; ctx.fillRect(x,y,size,size);
      ctx.globalAlpha=0.6; ctx.fillStyle=PAL.blood;
      ctx.beginPath(); ctx.ellipse(x+size/2,y+size/2,size*.4,size*.3,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      break;
    case 'door':
      ctx.fillStyle=PAL.wall; ctx.fillRect(x,y,size,size);
      ctx.fillStyle=PAL.door; ctx.fillRect(x+size*.15,y,size*.7,size);
      ctx.fillStyle=PAL.chestGld; ctx.fillRect(x+size*.42,y+size*.45,size*.16,size*.16);
      break;
    case 'chest':
      ctx.fillStyle=PAL.floorA; ctx.fillRect(x,y,size,size);
      ctx.fillStyle=PAL.chest; ctx.fillRect(x+size*.15,y+size*.35,size*.7,size*.5);
      ctx.fillStyle=PAL.chestGld;
      ctx.fillRect(x+size*.15,y+size*.45,size*.7,size*.08);
      ctx.fillRect(x+size*.45,y+size*.5,size*.1,size*.15);
      break;
    default:
      ctx.fillStyle='#050000'; ctx.fillRect(x,y,size,size);
  }
}

/* ══════════════════════════════════════════════════════════════
   BLOOD BOLT PROJECTILE — the new long-range basic attack
   Drawn as an elongated energy bolt with a glowing core.
══════════════════════════════════════════════════════════════ */
function drawBloodBolt(ctx, x, y, angle, size=14, alpha=1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Outer glow
  ctx.shadowColor = '#ff3347'; ctx.shadowBlur = 14;
  // Core bolt
  const g = ctx.createLinearGradient(-size, 0, size, 0);
  g.addColorStop(0, 'rgba(255,51,71,0)');
  g.addColorStop(0.3, '#ff3347');
  g.addColorStop(0.5, '#ff9090');
  g.addColorStop(0.7, '#ff3347');
  g.addColorStop(1, 'rgba(255,51,71,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size*0.28, 0, 0, Math.PI*2);
  ctx.fill();
  // Bright centre spark
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffb0b8';
  ctx.beginPath();
  ctx.ellipse(0, 0, size*0.22, size*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   ANIMATION CONTROLLER
══════════════════════════════════════════════════════════════ */
class AnimationController {
  constructor(frameCount=2, frameDuration=180) {
    this.frameCount=frameCount; this.frameDuration=frameDuration;
    this.currentFrame=0; this.elapsed=0;
  }
  update(dt, isMoving) {
    if (!isMoving) { this.currentFrame=0; this.elapsed=0; return; }
    this.elapsed+=dt;
    if (this.elapsed>=this.frameDuration) {
      this.elapsed=0;
      this.currentFrame=(this.currentFrame+1)%this.frameCount;
    }
  }
  reset() { this.currentFrame=0; this.elapsed=0; }
}

window.Sprites={
  TILE_SIZE, PAL,
  drawPixelMap, drawPlayerSprite, drawEnemySprite, drawBossSprite,
  drawBloodBolt, drawTile,
  ENEMY_SPRITES, BOSS_SPRITE_DATA,
  AnimationController
};