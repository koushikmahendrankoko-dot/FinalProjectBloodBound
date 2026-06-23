/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — progression.js
   Chapter transitions, save data sync, checkpoint/respawn logic,
   chapter completion rewards
═══════════════════════════════════════════════════════════════ */

class ProgressionManager {
  constructor() {
    this.saveData = null;
    this.isGuest = false;
  }

  load() {
    if (!window.BB || !window.BB.isLoggedIn()) {
      this.saveData = window.BB ? window.BB.defaultSaveData() : this._fallbackSave();
      this.isGuest = true;
    } else {
      this.saveData = window.BB.getSaveData();
      this.isGuest = false;
    }
    return this.saveData;
  }

  _fallbackSave() {
    return {
      currentChapter: 1, chaptersCompleted: [], bloodCoins: 0,
      maxHp: 100, currentHp: 100, baseAttack: 10, speed: 3,
      abilities: { slot1: 'blood_surge', slot2: 'crimson_whirl', slot3: null, slot4: null },
      unlockedAbilities: ['blood_surge', 'crimson_whirl'],
      purchases: [], inventory: { smallPotions: 0, largePotions: 0, reviveCharm: false },
      relics: [], storyFlags: { sparedLordVael: null, obelisksActivated: [], dialogueSeen: [] },
      settings: { masterVolume: 70, musicVolume: 60, sfxVolume: 80, pixelFilter: true, screenShake: true },
      stats: { deaths: 0, enemiesDefeated: 0, bossesDefeated: 0, totalPlayTime: 0, hpSacrificed: 0 }
    };
  }

  save() {
    if (this.isGuest || !window.BB) return false;
    return window.BB.saveSaveData(this.saveData);
  }

  syncFromPlayer(player) {
    this.saveData.currentHp = Math.round(player.hp);
    this.saveData.maxHp = player.maxHp;
    this.saveData.bloodCoins = player.bloodCoins;
    this.saveData.inventory.smallPotions = player.smallPotions;
    this.saveData.inventory.largePotions = player.largePotions;
  }

  applyToPlayer(player) {
    player.maxHp = this.saveData.maxHp;
    player.hp = this.saveData.currentHp > 0 ? this.saveData.currentHp : this.saveData.maxHp;
    player.baseAttack = this.saveData.baseAttack;
    player.speed = this.saveData.speed;
    player.abilities = this.saveData.abilities;
    player.bloodCoins = this.saveData.bloodCoins;
    player.smallPotions = this.saveData.inventory.smallPotions;
    player.largePotions = this.saveData.inventory.largePotions;
    player.reviveCharm = this.saveData.inventory.reviveCharm;
    player.hasRevived = false;
  }

  completeChapter(chapterNum) {
    if (!this.saveData.chaptersCompleted.includes(chapterNum)) {
      this.saveData.chaptersCompleted.push(chapterNum);
    }

    const rewards = this._getChapterRewards(chapterNum);

    if (rewards.bloodCoins) this.saveData.bloodCoins += rewards.bloodCoins;
    if (rewards.unlockAbility) {
      const ab = rewards.unlockAbility;
      if (!this.saveData.unlockedAbilities.includes(ab.key)) {
        this.saveData.unlockedAbilities.push(ab.key);
      }
      const slotKey = 'slot' + ab.slot;
      if (!this.saveData.abilities[slotKey]) {
        this.saveData.abilities[slotKey] = ab.key;
      }
    }

    this.saveData.stats.bossesDefeated = (this.saveData.stats.bossesDefeated || 0) + 1;

    if (chapterNum < 5) {
      this.saveData.currentChapter = chapterNum + 1;
      this.saveData.checkpointId = `ch${chapterNum + 1}_start`;
    }

    this.save();
    return rewards;
  }

  _getChapterRewards(chapterNum) {
    const rewards = {
      1: { bloodCoins: 50,  unlockAbility: { key: 'lifesteal', slot: 3 }, labels: ['Lifesteal Unlocked', '+50 🩸'] },
      2: { bloodCoins: 100, labels: ['+100 🩸', 'Key of Crimson'] },
      3: { bloodCoins: 150, labels: ['+150 🩸', 'Shop Tier II'] },
      4: { bloodCoins: 200, unlockAbility: { key: 'sanguine_sacrifice', slot: 4 }, labels: ['Sanguine Sacrifice Unlocked', '+200 🩸'] },
      5: { bloodCoins: 500, labels: ['Game Complete!', '+500 🩸'] }
    };
    return rewards[chapterNum] || { bloodCoins: 0, labels: [] };
  }

  recordDeath() {
    this.saveData.stats.deaths = (this.saveData.stats.deaths || 0) + 1;
    this.save();
  }

  getRespawnHp() {
    return Math.round(this.saveData.maxHp * 0.5);
  }

  setFlag(key, value) {
    this.saveData.storyFlags[key] = value;
    this.save();
  }

  getFlag(key) {
    return this.saveData.storyFlags[key];
  }

  activateObelisk(obeliskId) {
    if (!this.saveData.storyFlags.obelisksActivated.includes(obeliskId)) {
      this.saveData.storyFlags.obelisksActivated.push(obeliskId);
    }
    this.save();
    return this.saveData.storyFlags.obelisksActivated.length;
  }

  allObelisksActivated() {
    return this.saveData.storyFlags.obelisksActivated.length >= 4;
  }

  hasSeenDialogue(key) {
    return this.saveData.storyFlags.dialogueSeen.includes(key);
  }

  markDialogueSeen(key) {
    if (!this.saveData.storyFlags.dialogueSeen.includes(key)) {
      this.saveData.storyFlags.dialogueSeen.push(key);
    }
  }

  getEnding() {
    const sparedVael = this.saveData.storyFlags.sparedLordVael === true;
    const allObelisks = this.allObelisksActivated();

    if (sparedVael && allObelisks) return 'true_break';
    if (sparedVael || allObelisks) return 'partial';
    return 'absorb';
  }

  resetProgress() {
    if (window.BB && !this.isGuest) {
      window.BB.resetSaveData();
      this.saveData = window.BB.getSaveData();
    } else {
      this.saveData = this._fallbackSave();
    }
    return this.saveData;
  }

  hasPurchased(itemId) {
    return this.saveData.purchases.includes(itemId);
  }
}

window.ProgressionManager = ProgressionManager;