/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — story.js
   Dialogue trees, cutscenes, chapter intro/outro narration,
   story flag tracking (Lord Vael spared/killed, obelisks, etc)
═══════════════════════════════════════════════════════════════ */

const DIALOGUE = {
  ch1_intro: [
    { speaker: 'Village Elder', text: "The flames... they come for all of us. Take my hand, child." },
    { speaker: 'Village Elder', text: "This rune will keep you alive — but it will demand payment in blood. Your own." },
    { speaker: 'Village Elder', text: "Survive. Find the source of this curse. End it... or become it." },
    { speaker: 'You', text: "I will not let this village's death be meaningless." }
  ],
  ch1_boss_intro: [
    { speaker: '???', text: "You wear the rune now. Interesting." },
    { speaker: 'Village Guardian', text: "I was the village's protector. Now I protect its ashes. You will join them." }
  ],
  ch1_outro: [
    { speaker: 'You', text: "The guardian... it was corrupted by the same curse as me." },
    { speaker: 'You', text: "If the village's protector could fall this far, what else has this curse touched?" },
    { speaker: 'You', text: "The forest path leads underground. I have to keep moving." }
  ],

  ch2_intro: [
    { speaker: 'You', text: "An ancient dungeon, hidden beneath the village. Someone built this to keep something in." },
    { speaker: '???', text: "...or someone out." }
  ],
  ch2_boss_intro: [
    { speaker: 'Hollow Beast', text: "*A guttural roar echoes through the stone halls*" },
    { speaker: 'You', text: "Whatever they sealed down here... I understand why now." }
  ],
  ch2_outro: [
    { speaker: 'You', text: "The beast is dead, but its blood matched mine — cursed, just like me." },
    { speaker: 'You', text: "There's a passage north, toward a castle. Someone with authority did this." }
  ],

  ch3_intro: [
    { speaker: 'You', text: "The Crimson Castle. Lord Vael's banners fly over everything — even the ashes of my village." },
    { speaker: 'You', text: "If anyone ordered the attack, it was him." }
  ],
  ch3_boss_intro: [
    { speaker: 'Lord Vael', text: "So the curse found a new host. I wondered when you'd come." },
    { speaker: 'You', text: "You knew about this curse?" },
    { speaker: 'Lord Vael', text: "Knew? Child... I have worn it longer than you've been alive." }
  ],
  ch3_boss_reveal: [
    { speaker: 'Lord Vael', text: "*His sleeve tears away, revealing a blood rune identical to yours*" },
    { speaker: 'Lord Vael', text: "We are not so different. I burned your village to slow what's coming. I failed." },
    { speaker: 'Lord Vael', text: "The choice is yours now. End me, or let me help you finish this." }
  ],
  ch3_outro_spare: [
    { speaker: 'Lord Vael', text: "Thank you... for the mercy I did not deserve. Take this — it may ease your burden." },
    { speaker: 'You', text: "Tell me where the curse began." },
    { speaker: 'Lord Vael', text: "A temple, east of here. Find the four obelisks. They guard the truth." }
  ],
  ch3_outro_kill: [
    { speaker: 'You', text: "Whatever truth he knew, it dies with him." },
    { speaker: 'You', text: "There are temple ruins marked on his maps. East. That's where I'll find my answers." }
  ],

  ch4_intro: [
    { speaker: 'You', text: "The Blood Temple. The rune on my hand has never burned this bright." },
    { speaker: '???', text: "It recognizes its birthplace." }
  ],
  ch4_obelisk: [
    { speaker: 'Obelisk', text: "*Ancient blood-script flares to life as you approach*" }
  ],
  ch4_boss_intro: [
    { speaker: 'Guardian of Flame', text: "Four were chosen to guard this place. Four trials remain." },
    { speaker: 'You', text: "Then let's begin." }
  ],
  ch4_outro: [
    { speaker: 'You', text: "The Guardians are silent now. The temple's heart lies beyond — and so does the truth." },
    { speaker: 'You', text: "I can feel something ancient. Something that has been waiting." }
  ],

  ch5_intro: [
    { speaker: '???', text: "You came further than any before you. Curious." },
    { speaker: 'You', text: "Who are you?" },
    { speaker: 'The Blood God', text: "I am the first wound. The first sacrifice. I am what you will become." }
  ],
  ch5_boss_phase3: [
    { speaker: 'The Blood God', text: "Your blood remembers what your mind has forgotten." },
    { speaker: 'The Blood God', text: "I was a villager once — like you. I gave everything to save my people. This is what's left." }
  ],
  ch5_ending_break: [
    { speaker: 'You', text: "I won't become this. The curse ends with me." },
    { speaker: 'The Blood God', text: "Then... finally... rest." },
    { speaker: 'Narrator', text: "The blood rune crumbles to ash. The curse is broken — but at what cost remains unknown." }
  ],
  ch5_ending_absorb: [
    { speaker: 'You', text: "If this power exists... let it exist in someone who remembers what it costs." },
    { speaker: 'The Blood God', text: "Then carry it well. Carry it better than I did." },
    { speaker: 'Narrator', text: "The curse does not end. It changes hands. The blood rune burns brighter than ever before." }
  ]
};

class StoryManager {
  constructor() {
    this.queue = [];
    this.currentLine = null;
    this.active = false;
    this.onComplete = null;

    this.overlay = document.getElementById('cutscene-overlay');
    this.speakerEl = document.getElementById('dialogue-speaker');
    this.textEl = document.getElementById('dialogue-text');
    this.portraitEl = document.getElementById('dialogue-portrait');
  }

  play(dialogueKey, onComplete) {
    const lines = DIALOGUE[dialogueKey];
    if (!lines || lines.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.queue = [...lines];
    this.onComplete = onComplete;
    this.active = true;
    this.overlay.classList.remove('hidden');
    this._showNext();
  }

  _showNext() {
    if (this.queue.length === 0) {
      this._end();
      return;
    }
    this.currentLine = this.queue.shift();
    this.speakerEl.textContent = this.currentLine.speaker;
    this.textEl.textContent = '';
    this._typewriter(this.currentLine.text);

    const isNarrator = this.currentLine.speaker === 'Narrator';
    const isVillain = ['Lord Vael', 'The Blood God', '???'].includes(this.currentLine.speaker);
    this.portraitEl.style.borderColor = isVillain ? '#ffcc02' : isNarrator ? '#5c1018' : '#b52030';
  }

  _typewriter(text) {
    let i = 0;
    clearInterval(this._typeInterval);
    this._typeInterval = setInterval(() => {
      this.textEl.textContent = text.slice(0, i);
      i++;
      if (i > text.length) clearInterval(this._typeInterval);
    }, 22);
  }

  advance() {
    if (!this.active) return;
    clearInterval(this._typeInterval);
    if (this.textEl.textContent === this.currentLine.text) {
      this._showNext();
    } else {
      this.textEl.textContent = this.currentLine.text;
    }
  }

  _end() {
    this.active = false;
    this.overlay.classList.add('hidden');
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  skip() {
    clearInterval(this._typeInterval);
    this.queue = [];
    this._end();
  }
}

window.DIALOGUE = DIALOGUE;
window.StoryManager = StoryManager;