class MidiWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "midi");
    this.voiceFreq = new Float32Array(4);
    this.voiceNote = new Int32Array(4);
    this.voiceNote.fill(-1);
    this.note = 0;
    this.freq = 0;
    this.velocity = 0;
    this.modWheel = 0;
    this.pitchBend = 0;
    this.cc = new Float32Array(32);
    this.rememberVelocity = 0;
    this.steal = 0;
  }

  stealSlot() {
    let s = this.steal;
    this.steal = (s + 1) & 3;
    return s;
  }

  applyEvent(packed) {
    let type = packed & 255;
    let a = (packed >>> 8) & 255;
    let b = (packed >>> 16) & 255;
    let c = (packed >>> 24) & 255;
    if (type === AppConfig.SAB_EVT_NOTE) {
      if (b === 0) {
        for (let i = 0; i < 4; i++) {
          if (this.voiceNote[i] === a) {
            this.voiceNote[i] = -1;
            this.voiceFreq[i] = 0;
          }
        }
        if (this.note === a) {
          this.note = 0;
          this.velocity = 0;
        }
      } else {
        let slot = -1;
        for (let i = 0; i < 4; i++) {
          if (this.voiceNote[i] === a || this.voiceNote[i] < 0) {
            slot = i;
            if (this.voiceNote[i] === a) break;
            if (this.voiceNote[i] < 0 && slot < 0) slot = i;
          }
        }
        if (slot < 0) {
          for (let i = 0; i < 4; i++) {
            if (this.voiceNote[i] < 0) {
              slot = i;
              break;
            }
          }
        }
        if (slot < 0) slot = this.stealSlot();
        this.voiceNote[slot] = a;
        this.voiceFreq[slot] = AppConfig.midiToHz(a);
        if (a !== this.note) {
          this.velocity = 0;
          this.rememberVelocity = b / 127;
        }
        this.note = a;
        this.freq = this.voiceFreq[slot];
      }
    } else if (type === AppConfig.SAB_EVT_MOD) {
      this.modWheel = a / 127;
    } else if (type === AppConfig.SAB_EVT_BEND) {
      this.pitchBend = (a | (b << 8)) / 8192 - 1;
    } else if (type === AppConfig.SAB_EVT_CC || type === AppConfig.SAB_EVT_PAD) {
      this.cc[c] = b / 127;
      if (this.sab && type === AppConfig.SAB_EVT_CC) {
        this.sab.setSlot(16 + (c & 15), this.cc[c]);
        this.sab.setNote(c);
      }
    }
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) {
      this.modWheel = sab.getSlot(8);
      this.pitchBend = sab.getSlot(9);
      let ev;
      while ((ev = sab.pullEvent())) this.applyEvent(ev);
    }
    let n = 0;
    let o0 = outputs[0] && outputs[0][0];
    if (o0) n = o0.length;
    if (!n) return true;
    let f0 = this.voiceFreq[0];
    let f1 = this.voiceFreq[1];
    let f2 = this.voiceFreq[2];
    let f3 = this.voiceFreq[3];
    let vel = this.velocity;
    let mod = this.modWheel;
    let bend = this.pitchBend;
    if (o0) o0.fill(f0);
    let o1 = outputs[1] && outputs[1][0];
    if (o1) o1.fill(f1);
    let o2 = outputs[2] && outputs[2][0];
    if (o2) o2.fill(f2);
    let o3 = outputs[3] && outputs[3][0];
    if (o3) o3.fill(f3);
    let velOut = outputs[4] && outputs[4][0];
    if (velOut) velOut.fill(vel);
    let modOut = outputs[5] && outputs[5][0];
    if (modOut) modOut.fill(mod);
    let bendOut = outputs[6] && outputs[6][0];
    if (bendOut) bendOut.fill(bend);
    for (let i = 7; i < outputs.length; i++) {
      let ch = outputs[i] && outputs[i][0];
      if (ch) ch.fill(this.cc[i] || 0);
    }
    if (this.rememberVelocity) {
      this.velocity = this.rememberVelocity;
      this.rememberVelocity = 0;
    }
    if (sab) {
      sab.setSlot(0, f0);
      sab.setSlot(1, f1);
      sab.setSlot(2, f2);
      sab.setSlot(3, f3);
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("midi-worklet", MidiWorklet);
