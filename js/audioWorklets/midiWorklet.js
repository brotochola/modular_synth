class MidiWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "midi");
    this.voiceFreq = new Float32Array(4);
    this.voiceVel = new Float32Array(4);
    this.pendingVel = new Float32Array(4);
    this.hasPendingVel = new Uint8Array(4);
    this.voiceNote = new Int32Array(4);
    this.voiceNote.fill(-1);
    this.modWheel = 0;
    this.pitchBend = 0;
    this.cc = new Float32Array(32);
    this.steal = 0;
  }

  stealSlot() {
    let s = this.steal;
    this.steal = (s + 1) & 3;
    return s;
  }

  allocSlot(note) {
    for (let i = 0; i < 4; i++) {
      if (this.voiceNote[i] === note) return i;
    }
    for (let i = 0; i < 4; i++) {
      if (this.voiceNote[i] < 0) return i;
    }
    return this.stealSlot();
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
            this.voiceVel[i] = 0;
            this.hasPendingVel[i] = 0;
          }
        }
      } else {
        let slot = this.allocSlot(a);
        this.voiceNote[slot] = a;
        this.voiceFreq[slot] = AppConfig.midiToHz(a);
        this.voiceVel[slot] = 0;
        this.pendingVel[slot] = b / 127;
        this.hasPendingVel[slot] = 1;
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
    for (let i = 0; i < 4; i++) {
      let ch = outputs[i] && outputs[i][0];
      if (ch) ch.fill(this.voiceFreq[i]);
      let velCh = outputs[4 + i] && outputs[4 + i][0];
      if (velCh) velCh.fill(this.voiceVel[i]);
    }
    let modOut = outputs[8] && outputs[8][0];
    if (modOut) modOut.fill(this.modWheel);
    let bendOut = outputs[9] && outputs[9][0];
    if (bendOut) bendOut.fill(this.pitchBend);
    for (let i = 10; i < outputs.length; i++) {
      let ch = outputs[i] && outputs[i][0];
      if (ch) ch.fill(this.cc[i] || 0);
    }
    for (let i = 0; i < 4; i++) {
      if (this.hasPendingVel[i]) {
        this.voiceVel[i] = this.pendingVel[i];
        this.hasPendingVel[i] = 0;
      }
    }
    if (sab) {
      sab.setSlot(0, this.voiceFreq[0]);
      sab.setSlot(1, this.voiceFreq[1]);
      sab.setSlot(2, this.voiceFreq[2]);
      sab.setSlot(3, this.voiceFreq[3]);
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("midi-worklet", MidiWorklet);
