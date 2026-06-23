/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — audio.js (v3 — full upgrade)
   Procedural Web Audio API music + SFX.
   Each chapter has a unique musical identity.
   Boss theme is intense and layered.
   All SFX synthesized — no files needed.
═══════════════════════════════════════════════════════════════ */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain  = null;
    this.sfxGain    = null;
    this.masterVolume = 0.7;
    this.musicVolume  = 0.55;
    this.sfxVolume    = 0.85;
    this.currentMusicKey   = null;
    this.currentMusicNodes = [];
    this.musicTimer = null;
    this.unlocked   = false;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this._gain(this.masterVolume);
      this.musicGain  = this._gain(this.musicVolume);
      this.sfxGain    = this._gain(this.sfxVolume);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.unlocked = true;
    } catch(e) { console.warn('Web Audio unavailable', e); }
  }

  _gain(val) {
    const g = this.ctx.createGain();
    g.gain.value = val;
    return g;
  }

  setMasterVolume(v) { this.masterVolume=v; if(this.masterGain) this.masterGain.gain.value=v; }
  setMusicVolume(v)  { this.musicVolume=v;  if(this.musicGain)  this.musicGain.gain.value=v;  }
  setSfxVolume(v)    { this.sfxVolume=v;    if(this.sfxGain)    this.sfxGain.gain.value=v;    }

  /* ── SFX ── */
  playSfx(type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch(type) {

      /* Blood bolt fire — sharp whip crack + bass thud */
      case 'attack':
        this._tone(880, 'sawtooth', t,    0.03, 0.18);
        this._sweep(300, 80,        t,    0.12, 0.22);
        this._tone(60,  'sine',     t+.01,0.08, 0.14);
        break;

      /* Blood bolt hit — meaty impact */
      case 'hit':
        this._sweep(200, 60,  t,    0.15, 0.28);
        this._noise(t, 0.06, 0.15);
        break;

      /* Blood ability — visceral power */
      case 'blood_ability':
        this._tone(110,  'sawtooth', t,    0.25, 0.3);
        this._sweep(800, 200,        t,    0.18, 0.22);
        this._tone(55,   'sine',     t+.05,0.35, 0.25);
        this._reverb(t+.1, 0.12);
        break;

      /* Parry — crisp metallic ring */
      case 'parry':
        this._tone(1200, 'sine',     t,    0.04, 0.25);
        this._tone(600,  'triangle', t,    0.06, 0.2);
        this._sweep(900, 1800,       t,    0.08, 0.18);
        break;

      /* Parry success — triumphant chime */
      case 'parry_success':
        [880,1100,1320].forEach((f,i)=>this._tone(f,'sine',t+i*.05,0.1,0.3));
        break;

      /* Dodge roll — woosh */
      case 'roll':
        this._sweep(400, 200, t, 0.18, 0.15);
        this._noise(t, 0.04, 0.1);
        break;

      /* Player hurt — pain grunt + bass drop */
      case 'hurt':
        this._tone(160, 'sawtooth', t,    0.18, 0.22);
        this._sweep(120, 40,        t,    0.2,  0.18);
        break;

      /* Player death — dramatic fall */
      case 'death':
        this._sweep(400, 30, t,    0.8,  0.35);
        this._tone(80, 'sine', t+.1,0.4, 0.4);
        this._sweep(200,60, t+.3, 0.5,  0.3);
        break;

      /* Enemy death — satisfying crunch */
      case 'enemy_death':
        this._sweep(300, 50, t, 0.12, 0.2);
        this._noise(t, 0.08, 0.1);
        break;

      /* Boss hurt — heavy */
      case 'boss_hurt':
        this._sweep(150, 40, t, 0.3, 0.35);
        this._noise(t, 0.12, 0.2);
        break;

      /* Boss phase transition — dramatic */
      case 'boss_phase':
        this._sweep(60, 200, t, 0.6, 0.4);
        this._sweep(200, 60, t+.2, 0.5, 0.35);
        this._tone(440, 'sawtooth', t+.4, 0.15, 0.4);
        this._reverb(t+.5, 0.25);
        break;

      /* Boss roar */
      case 'boss_roar':
        this._sweep(80, 200, t, 0.5, 0.38);
        this._sweep(60, 40,  t+.1, 0.6, 0.3);
        this._tone(40, 'sine', t, 0.4, 0.5);
        break;

      /* Chest open — jingle */
      case 'chest_open':
        [440,554,660,880].forEach((f,i)=>this._tone(f,'triangle',t+i*.08,0.12,0.2));
        break;

      /* Potion */
      case 'potion':
        this._tone(523,'sine',t,    0.15,0.18);
        this._tone(659,'sine',t+.1, 0.15,0.15);
        this._tone(784,'sine',t+.18,0.18,0.2);
        break;

      /* Menu click */
      case 'menu_click':
        this._tone(440,'square',t,0.04,0.08);
        break;

      /* Achievement unlock — fanfare */
      case 'achievement':
        [523,659,784,1047].forEach((f,i)=>this._tone(f,'sine',t+i*.07,0.14,0.3));
        this._tone(1047,'sine',t+.3,0.2,0.5);
        break;

      /* Shop buy */
      case 'shop_buy':
        [330,440,550].forEach((f,i)=>this._tone(f,'sine',t+i*.06,0.1,0.2));
        break;

      case 'door_open': this._sweep(150,250,t,0.3,0.15); break;
      case 'level_up':  [440,554,660,880].forEach((f,i)=>this._tone(f,'sine',t+i*.1,0.15,0.2)); break;
    }
  }

  _tone(freq, type, startTime, duration, volume=0.2) {
    if (!this.ctx) return;
    const osc=this.ctx.createOscillator(), g=this.ctx.createGain();
    osc.type=type; osc.frequency.value=freq;
    g.gain.setValueAtTime(volume, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime+duration);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(startTime); osc.stop(startTime+duration+0.05);
  }

  _sweep(fromF, toF, startTime, duration, volume=0.2) {
    if (!this.ctx) return;
    const osc=this.ctx.createOscillator(), g=this.ctx.createGain();
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(fromF, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20,toF), startTime+duration);
    g.gain.setValueAtTime(volume, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime+duration);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(startTime); osc.stop(startTime+duration+0.05);
  }

  _noise(startTime, duration, volume=0.1) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i=0; i<bufferSize; i++) data[i]=(Math.random()*2-1)*volume;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime+duration);
    source.connect(g); g.connect(this.sfxGain);
    source.start(startTime);
  }

  _reverb(startTime, volume=0.15) {
    // Simple reverb via multiple delayed tones
    if (!this.ctx) return;
    [0.05,0.1,0.18,0.28].forEach((delay,i)=>{
      const g=this.ctx.createGain();
      g.gain.value=volume/(i+2);
      const osc=this.ctx.createOscillator();
      osc.type='sine'; osc.frequency.value=220*(i+1);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(startTime+delay); osc.stop(startTime+delay+0.3);
    });
  }

  /* ── MUSIC ── */
  playMusic(key) {
    if (this.currentMusicKey===key) return;
    this.stopMusic();
    this.currentMusicKey=key;
    if (!this.ctx) return;

    /* Each chapter has a distinct musical identity:
       Ch1 — ominous Zelda-style minor pentatonic
       Ch2 — dark Metroid-style drone + pulse
       Ch3 — regal but sinister castle theme
       Ch4 — deep blood temple ritual
       Ch5 / boss — intense Elden Ring-inspired
       gameover — slow descent */
    const profiles = {
      chapter1: { base:110, scale:[0,3,5,7,10], tempo:2000, wave:'triangle', droneBase:55,  droneMult:1.5  },
      chapter2: { base:82,  scale:[0,2,3,7,8],  tempo:1600, wave:'sawtooth', droneBase:41,  droneMult:1.0  },
      chapter3: { base:98,  scale:[0,3,5,8,10], tempo:1800, wave:'square',   droneBase:49,  droneMult:2.0  },
      chapter4: { base:73,  scale:[0,1,3,6,8],  tempo:1400, wave:'sawtooth', droneBase:36,  droneMult:1.5  },
      chapter5: { base:65,  scale:[0,1,2,6,7],  tempo:1200, wave:'sawtooth', droneBase:32,  droneMult:1.0  },
      boss:     { base:55,  scale:[0,1,3,6,7],  tempo:900,  wave:'square',   droneBase:27,  droneMult:2.0  },
      gameover: { base:44,  scale:[0,1,2],       tempo:3200, wave:'sawtooth', droneBase:22,  droneMult:1.5  },
      theme:    { base:130, scale:[0,4,7,9,11],  tempo:2400, wave:'sine',     droneBase:65,  droneMult:1.5  },
    };

    const p = profiles[key] || profiles.theme;
    this._scheduleDrone(p);
    this._scheduleMotif(p);
    if (key==='boss') this._scheduleBossPerc(p);
  }

  _scheduleDrone(p) {
    const osc1=this.ctx.createOscillator(), osc2=this.ctx.createOscillator();
    const osc3=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    osc1.type=p.wave; osc1.frequency.value=p.droneBase;
    osc2.type=p.wave; osc2.frequency.value=p.droneBase*p.droneMult;
    osc3.type='sine'; osc3.frequency.value=p.droneBase*0.5;
    g.gain.value=0.04;
    osc1.connect(g); osc2.connect(g); osc3.connect(g);
    g.connect(this.musicGain);
    osc1.start(); osc2.start(); osc3.start();
    this.currentMusicNodes.push(osc1,osc2,osc3,g);

    // LFO for pulse/swell
    const lfo=this.ctx.createOscillator(), lfoG=this.ctx.createGain();
    lfo.frequency.value=0.06; lfoG.gain.value=0.025;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    lfo.start();
    this.currentMusicNodes.push(lfo,lfoG);
  }

  _scheduleMotif(p) {
    let beat=0;
    const playNote=()=>{
      if (!this.ctx||!this.currentMusicKey) return;
      const t=this.ctx.currentTime;
      const semitone=p.scale[beat%p.scale.length];
      beat++;
      const octave=Math.random()>0.7?2:1;
      const freq=p.base*octave*Math.pow(2,semitone/12);
      const osc=this.ctx.createOscillator(), g=this.ctx.createGain();
      osc.type='sine'; osc.frequency.value=freq;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.06,t+0.25);
      g.gain.exponentialRampToValueAtTime(0.001,t+1.6);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t+2);
    };
    this.musicTimer=setInterval(playNote, p.tempo);
    playNote();
  }

  _scheduleBossPerc(p) {
    // Rhythmic kick-style pulse for boss fight
    let tick=0;
    const kickTimer=setInterval(()=>{
      if (!this.ctx||this.currentMusicKey!=='boss') { clearInterval(kickTimer); return; }
      const t=this.ctx.currentTime;
      if (tick%4===0) {
        this._sweep(80,30,t,0.15,0.18);
      }
      if (tick%2===1) {
        this._noise(t,0.04,0.08);
      }
      tick++;
    }, 400);
    this.currentMusicNodes.push({ stop:()=>clearInterval(kickTimer) });
  }

  stopMusic() {
    this.currentMusicNodes.forEach(n=>{
      try { n.stop&&n.stop(); } catch(e){}
      try { n.disconnect&&n.disconnect(); } catch(e){}
    });
    this.currentMusicNodes=[];
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer=null;
    this.currentMusicKey=null;
  }
}

window.AudioManager = AudioManager;