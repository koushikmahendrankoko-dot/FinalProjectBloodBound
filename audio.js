/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — audio.js
   Procedural audio via Web Audio API — ambient music loops and
   SFX synthesized in-browser (no audio files required).
═══════════════════════════════════════════════════════════════ */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    this.masterVolume = 0.7;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;

    this.currentMusicNodes = [];
    this.currentMusicKey = null;
    this.musicTimer = null;

    this.unlocked = false;
  }

  /* Must be called after a user gesture (click) to satisfy autoplay policies */
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.setMasterVolume(this.masterVolume);
      this.setMusicVolume(this.musicVolume);
      this.setSfxVolume(this.sfxVolume);

      this.unlocked = true;
    } catch (e) {
      console.warn('Web Audio API unavailable', e);
    }
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
    if (this.currentMusicFileNode) this.currentMusicFileNode.volume = this.musicVolume * v;
  }
  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
    if (this.currentMusicFileNode) this.currentMusicFileNode.volume = v * this.masterVolume;
  }
  setSfxVolume(v) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

  /* ── SFX: plays real file if loaded, else synthesizes ── */
  playSfx(type) {
    if (window.Assets && window.Assets.hasAudio('sfx_' + type)) {
      const baseAudio = window.Assets.getAudio('sfx_' + type);
      const node = baseAudio.cloneNode();
      node.volume = this.sfxVolume * this.masterVolume;
      node.play().catch(() => {});
      return;
    }
    this._synthSfx(type);
  }

  _synthSfx(type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    switch (type) {
      case 'attack':
        this._tone(220, 'square', t, 0.08, 0.15);
        break;
      case 'blood_ability':
        this._tone(180, 'sawtooth', t, 0.2, 0.25);
        this._tone(90, 'sine', t + 0.05, 0.3, 0.2);
        break;
      case 'hurt':
        this._tone(110, 'sawtooth', t, 0.15, 0.2);
        break;
      case 'death':
        this._sweep(300, 60, t, 0.6, 0.3);
        break;
      case 'pickup':
        this._tone(660, 'sine', t, 0.08, 0.15);
        this._tone(880, 'sine', t + 0.08, 0.1, 0.15);
        break;
      case 'boss_roar':
        this._sweep(80, 200, t, 0.5, 0.35);
        this._sweep(60, 40, t + 0.1, 0.6, 0.3);
        break;
      case 'chest_open':
        this._tone(440, 'triangle', t, 0.1, 0.15);
        this._tone(660, 'triangle', t + 0.1, 0.15, 0.15);
        this._tone(880, 'triangle', t + 0.2, 0.2, 0.15);
        break;
      case 'level_up':
        [440, 554, 660, 880].forEach((f, i) => this._tone(f, 'sine', t + i * 0.1, 0.15, 0.2));
        break;
      case 'menu_click':
        this._tone(330, 'square', t, 0.05, 0.1);
        break;
      case 'door_open':
        this._sweep(150, 250, t, 0.3, 0.15);
        break;
      case 'potion':
        this._tone(523, 'sine', t, 0.15, 0.18);
        this._tone(659, 'sine', t + 0.1, 0.15, 0.15);
        break;
    }
  }

  _tone(freq, type, startTime, duration, volume = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  _sweep(fromFreq, toFreq, startTime, duration, volume = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fromFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), startTime + duration);
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /* ── AMBIENT MUSIC LOOPS ──
     Plays real file if loaded; else generates a procedural drone. */
  playMusic(key) {
    if (this.currentMusicKey === key) return;
    this.stopMusic();
    this.currentMusicKey = key;

    if (window.Assets && window.Assets.hasAudio('music_' + key)) {
      const baseAudio = window.Assets.getAudio('music_' + key);
      const node = baseAudio.cloneNode();
      node.loop = true;
      node.volume = this.musicVolume * this.masterVolume;
      node.play().catch(() => {});
      this.currentMusicFileNode = node;
      return;
    }

    if (!this.ctx) return;

    const profiles = {
      chapter1: { base: 110, scale: [0, 3, 5, 7], tempo: 2200, wave: 'sine' },
      chapter2: { base: 82,  scale: [0, 2, 3, 7], tempo: 1800, wave: 'triangle' },
      chapter3: { base: 98,  scale: [0, 3, 5, 8], tempo: 2000, wave: 'sawtooth' },
      boss:     { base: 73,  scale: [0, 1, 3, 6], tempo: 1400, wave: 'square' },
      theme:    { base: 130, scale: [0, 4, 7, 9], tempo: 2400, wave: 'sine' },
      gameover: { base: 55,  scale: [0, 1, 2],    tempo: 3000, wave: 'sawtooth' }
    };

    const profile = profiles[key] || profiles.theme;
    this._scheduleDrone(profile);
    this._scheduleMotif(profile);
  }

  _scheduleDrone(profile) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = profile.wave;
    osc2.type = profile.wave;
    osc1.frequency.value = profile.base;
    osc2.frequency.value = profile.base * 1.5;

    gain.gain.value = 0.06;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.musicGain);

    osc1.start();
    osc2.start();

    this.currentMusicNodes.push(osc1, osc2, gain);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    this.currentMusicNodes.push(lfo, lfoGain);
  }

  _scheduleMotif(profile) {
    const playNote = () => {
      if (!this.ctx || this.currentMusicKey === null) return;
      const t = this.ctx.currentTime;
      const semitone = profile.scale[Math.floor(Math.random() * profile.scale.length)];
      const freq = profile.base * 2 * Math.pow(2, semitone / 12);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.08, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 2);
    };

    this.musicTimer = setInterval(playNote, profile.tempo);
  }

  stopMusic() {
    if (this.currentMusicFileNode) {
      this.currentMusicFileNode.pause();
      this.currentMusicFileNode = null;
    }
    this.currentMusicNodes.forEach(node => {
      try { node.stop && node.stop(); } catch (e) {}
      try { node.disconnect(); } catch (e) {}
    });
    this.currentMusicNodes = [];
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.currentMusicKey = null;
  }
}

window.AudioManager = AudioManager;