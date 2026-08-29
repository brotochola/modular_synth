class PolyphonicKeyboardWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "polyphonic-keyboard");
    this.maxVoices = 8;
    this.voiceFreq = new Float32Array(8);
    this.voiceNote = new Int32Array(8);
    this.voiceNote.fill(-1);
    this.steal = 0;
  }

  allocSlot(note) {
    for (let i = 0; i < this.maxVoices; i++) {
      if (this.voiceNote[i] === note) return i;
    }
    for (let i = 0; i < this.maxVoices; i++) {
      if (this.voiceNote[i] < 0) return i;
    }
    let s = this.steal;
    this.steal = (s + 1) & 7;
    return s;
  }

  applyEvent(packed) {
    let type = packed & 255;
    let note = (packed >>> 8) & 255;
    let down = (packed >>> 16) & 255;
    if (type === AppConfig.SAB_EVT_KEY && down === 0 && note === 255) {
      this.voiceNote.fill(-1);
      this.voiceFreq.fill(0);
      return;
    }
    if (type !== AppConfig.SAB_EVT_NOTE && type !== AppConfig.SAB_EVT_KEY) return;
    if (!down) {
      for (let i = 0; i < this.maxVoices; i++) {
        if (this.voiceNote[i] === note) {
          this.voiceNote[i] = -1;
          this.voiceFreq[i] = 0;
        }
      }
    } else {
      let slot = this.allocSlot(note);
      this.voiceNote[slot] = note;
      this.voiceFreq[slot] = AppConfig.midiToHz(note);
    }
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) {
      let ev;
      while ((ev = sab.pullEvent())) this.applyEvent(ev);
    }
    for (let o = 0; o < outputs.length && o < this.maxVoices; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (ch) ch.fill(this.voiceFreq[o]);
    }
    if (sab) {
      for (let i = 0; i < this.maxVoices; i++) sab.setSlot(i, this.voiceFreq[i]);
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("polyphonic-keyboard-worklet", PolyphonicKeyboardWorklet);
