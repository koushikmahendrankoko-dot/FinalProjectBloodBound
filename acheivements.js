/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — achievements.js
   Achievement definitions, unlock logic, persistence.
   Called from combat.js, player.js, progression.js, boss.js.
   Achievements page reads window.Achievements to render.
═══════════════════════════════════════════════════════════════ */

const ACHIEVEMENT_DEFS = [
  /* ── STORY ── */
  { id:'ch1_clear',    title:'Survivor',          desc:'Complete Chapter I.',                        icon:'🌲', tier:'bronze', secret:false },
  { id:'ch2_clear',    title:'Dungeon Delver',    desc:'Complete Chapter II.',                       icon:'🏚', tier:'bronze', secret:false },
  { id:'ch3_clear',    title:'Castle Crasher',    desc:'Complete Chapter III.',                      icon:'🏰', tier:'silver', secret:false },
  { id:'ch4_clear',    title:'Temple Sworn',      desc:'Complete Chapter IV.',                       icon:'🩸', tier:'silver', secret:false },
  { id:'ch5_clear',    title:'Bloodbound',        desc:'Complete the game.',                         icon:'☠',  tier:'gold',   secret:false },
  { id:'spare_vael',   title:'Mercy of the Rune', desc:'Spare Lord Vael.',                           icon:'👑', tier:'silver', secret:true  },
  { id:'kill_vael',    title:'No Mercy',          desc:'Finish Lord Vael.',                          icon:'⚔️', tier:'silver', secret:true  },
  { id:'all_obelisks', title:'Blood Ritualist',   desc:'Activate all 4 obelisks in Chapter IV.',     icon:'🗿', tier:'gold',   secret:true  },
  { id:'true_ending',  title:'Break the Curse',   desc:'Achieve the true ending.',                   icon:'✨', tier:'gold',   secret:true  },

  /* ── COMBAT ── */
  { id:'first_kill',   title:'First Blood',       desc:'Defeat your first enemy.',                   icon:'🩸', tier:'bronze', secret:false },
  { id:'kills_50',     title:'Slaughterer',       desc:'Defeat 50 enemies.',                         icon:'⚔️', tier:'bronze', secret:false },
  { id:'kills_200',    title:'Blood Reaper',      desc:'Defeat 200 enemies.',                        icon:'💀', tier:'silver', secret:false },
  { id:'kills_500',    title:'Lord of Carnage',   desc:'Defeat 500 enemies.',                        icon:'☠',  tier:'gold',   secret:false },
  { id:'parry_first',  title:'Perfect Guard',     desc:'Successfully parry an attack.',              icon:'🛡️', tier:'bronze', secret:false },
  { id:'parry_10',     title:'Deflector',         desc:'Parry 10 attacks.',                          icon:'🛡️', tier:'silver', secret:false },
  { id:'parry_boss',   title:'Untouchable',       desc:'Parry a boss attack.',                       icon:'⚡', tier:'gold',   secret:true  },
  { id:'no_damage_boss','title':'Ghost of Blood',  desc:'Defeat any boss without taking damage.',    icon:'👻', tier:'gold',   secret:true  },
  { id:'roll_50',      title:'Rolling Thunder',   desc:'Dodge roll 50 times.',                       icon:'💨', tier:'bronze', secret:false },

  /* ── ABILITIES ── */
  { id:'ability_first', title:'Blood Awakens',    desc:'Use your first blood ability.',              icon:'⚡', tier:'bronze', secret:false },
  { id:'sacrifice_use', title:'The Price of Power',desc:'Use Sanguine Sacrifice.',                   icon:'☠',  tier:'silver', secret:false },
  { id:'hp_sac_500',   title:'Blood Tithe',       desc:'Sacrifice 500 total HP to abilities.',       icon:'🩸', tier:'silver', secret:false },
  { id:'hp_sac_2000',  title:'Willing Vessel',    desc:'Sacrifice 2000 total HP to abilities.',      icon:'💔', tier:'gold',   secret:false },
  { id:'low_hp_kill',  title:'Death\'s Edge',     desc:'Kill a boss while under 10 HP.',             icon:'❤️', tier:'gold',   secret:true  },

  /* ── EXPLORATION ── */
  { id:'chest_first',  title:'Treasure Hunter',   desc:'Open your first chest.',                     icon:'📦', tier:'bronze', secret:false },
  { id:'chest_10',     title:'Hoarder',           desc:'Open 10 chests.',                            icon:'💰', tier:'silver', secret:false },
  { id:'potion_use',   title:'In a Pinch',        desc:'Use a health potion.',                       icon:'🧪', tier:'bronze', secret:false },
  { id:'shop_first',   title:'Blood Merchant',    desc:'Buy something from the shop.',               icon:'🛒', tier:'bronze', secret:false },
  { id:'all_abilities',title:'Full Arsenal',      desc:'Unlock all 7 blood abilities.',              icon:'🌟', tier:'gold',   secret:false },

  /* ── DEATHS / PERSISTENCE ── */
  { id:'first_death',  title:'The Rune Remembers',desc:'Die for the first time.',                    icon:'💀', tier:'bronze', secret:false },
  { id:'deaths_10',    title:'Stubborn',          desc:'Die 10 times and keep going.',               icon:'🔄', tier:'silver', secret:false },
  { id:'no_death_ch1', title:'Untarnished',       desc:'Complete Chapter I without dying.',          icon:'🌟', tier:'gold',   secret:true  },
  { id:'revive_charm', title:'Second Chance',     desc:'Survive death with the Revival Charm.',      icon:'✨', tier:'silver', secret:true  },
];

const ACH_KEY = 'bb_achievements';

class AchievementManager {
  constructor() {
    this._data = this._load();
    this._queue = []; // unlocked this session, shown as toasts
    this._listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(ACH_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  _save() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(this._data)); } catch(e) {}
  }

  isUnlocked(id) { return !!this._data[id]; }

  getUnlockedAt(id) { return this._data[id]?.unlockedAt || null; }

  /* Unlock an achievement. Returns true if newly unlocked. */
  unlock(id) {
    if (this._data[id]) return false; // already have it
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (!def) return false;
    this._data[id] = { unlockedAt: Date.now() };
    this._save();
    this._queue.push(def);
    this._listeners.forEach(fn => fn(def));
    return true;
  }

  /* Increment a counter-based achievement */
  increment(counterId, thresholds) {
    const key = 'ctr_' + counterId;
    this._data[key] = (this._data[key] || 0) + 1;
    this._save();
    const val = this._data[key];
    for (const [threshold, achId] of thresholds) {
      if (val >= threshold) this.unlock(achId);
    }
    return this._data[key];
  }

  getCounter(id) { return this._data['ctr_' + id] || 0; }

  /* Pop next queued unlock for toast display */
  popQueue() { return this._queue.shift() || null; }

  onUnlock(fn) { this._listeners.push(fn); }

  getAllProgress() {
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: this.isUnlocked(def.id),
      unlockedAt: this.getUnlockedAt(def.id)
    }));
  }

  getStats() {
    const total   = ACHIEVEMENT_DEFS.length;
    const unlocked= ACHIEVEMENT_DEFS.filter(d => this.isUnlocked(d.id)).length;
    const gold    = ACHIEVEMENT_DEFS.filter(d => d.tier==='gold'   && this.isUnlocked(d.id)).length;
    const silver  = ACHIEVEMENT_DEFS.filter(d => d.tier==='silver' && this.isUnlocked(d.id)).length;
    const bronze  = ACHIEVEMENT_DEFS.filter(d => d.tier==='bronze' && this.isUnlocked(d.id)).length;
    return { total, unlocked, gold, silver, bronze, pct: Math.round(unlocked/total*100) };
  }
}

window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;
window.AchievementManager = AchievementManager;
// Global singleton — created once in main.js, used everywhere
window.Achievements = window.Achievements || new AchievementManager();