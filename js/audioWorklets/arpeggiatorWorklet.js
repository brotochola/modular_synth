class ArpeggiatorWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "minOctaves",
        defaultValue: 0,
        minValue: 0,
        maxValue: 4,
        automationRate: "k-rate",
      },
      {
        name: "maxOctaves",
        defaultValue: 0,
        minValue: 0,
        maxValue: 4,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "arpeggiator");
    this.bpm = 0;
    this.durationOfOneNote = 0;
    this.applyBpm(AppConfig.FALLBACK_BPM);
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.lastBpmRaw = null;
    this.externalClock = false;
    this.syncToBeat = false;
    this.clockOn = 0;
    this.clockSkew = 0;
    this.pulseRemaining = 0;
    this.pulseLength = AppConfig.trigPulseSamples(sampleRate);
    this.mode = 0;
    this.heldHz = 0;
    this.trigGen = 0;
    this.noteCh = [null, null, null, null];
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.mode != null) this.mode = this.parseMode(d.mode);
    };
  }

  parseMode(v) {
    if (v === "down") return 1;
    if (v === "upDown") return 2;
    let n = Math.round(Number(v) || 0);
    if (n === 1) return 1;
    if (n === 2) return 2;
    return 0;
  }

  applyBpm(bpm) {
    if (!(bpm > 0)) return;
    if (bpm === this.bpm && this.durationOfOneNote) return;
    this.bpm = bpm;
    this.durationOfOneNote = (60000 / bpm) * AppConfig.SEQ_STEP_QUARTER;
  }

  readControl() {
    let sab = this.sab;
    if (!sab) return;
    this.applyBpm(sab.getBpm());
    this.clockSkew = sab.getSlot(16);
    this.syncToBeat = sab.getSlot(17) > 0.5;
    if (this.syncToBeat) this.externalClock = false;
    this.mode = this.parseMode(sab.getSlot(18));
  }

  sampleNotes(i) {
    let notes = [];
    for (let n = 0; n < 4; n++) {
      let ch = this.noteCh[n];
      if (!ch || !ch.length) continue;
      let hz = ch[i < ch.length ? i : ch.length - 1];
      if (hz > 1) notes.push(hz);
    }
    notes.sort((a, b) => a - b);
    return notes;
  }

  buildPattern(notes, minOct, maxOct) {
    let list = [];
    for (let oct = -minOct; oct <= maxOct; oct++) {
      let mul = Math.pow(2, oct);
      for (let i = 0; i < notes.length; i++) list.push(notes[i] * mul);
    }
    if (this.mode === 1) {
      list.reverse();
    } else if (this.mode === 2 && list.length > 1) {
      for (let i = list.length - 2; i >= 1; i--) list.push(list[i]);
    }
    return list;
  }

  takeStep(i, minOct, maxOct) {
    let pattern = this.buildPattern(this.sampleNotes(i), minOct, maxOct);
    if (!pattern.length) {
      this.heldHz = 0;
      this.currentNote = 0;
      this.postPlayhead();
      return;
    }
    let len = pattern.length;
    this.currentNote = ((this.currentNote % len) + len) % len;
    this.heldHz = pattern[this.currentNote];
    this.pulseRemaining = this.pulseLength;
    this.trigGen++;
    this.postPlayhead();
  }

  postPlayhead() {
    let sab = this.sab;
    if (sab) {
      if (this.currentNote !== this.lastPostedNote) {
        this.lastPostedNote = this.currentNote;
        sab.setNote(this.currentNote);
      }
      sab.setSlot(0, this.heldHz);
      sab.setSlot(1, this.trigGen);
    }
  }

  process(inputs, outputs, parameters) {
    this.readControl();
    if (!this.durationOfOneNote) return true;
    let hzChannel = outputs[0] && outputs[0][0];
    let trigChannel = outputs[1] && outputs[1][0];
    let n =
      (hzChannel && hzChannel.length) ||
      (trigChannel && trigChannel.length) ||
      128;
    let clockChannel = inputs[0] && inputs[0][0];
    this.noteCh[0] = inputs[1] && inputs[1][0];
    this.noteCh[1] = inputs[2] && inputs[2][0];
    this.noteCh[2] = inputs[3] && inputs[3][0];
    this.noteCh[3] = inputs[4] && inputs[4][0];

    let minArr = parameters.minOctaves;
    let maxArr = parameters.maxOctaves;
    let minOct = Math.round(Math.min(4, Math.max(0, minArr[0] || 0)));
    let maxOct = Math.round(Math.min(4, Math.max(0, maxArr[0] || 0)));

    if (clockChannel && clockChannel.length && !this.syncToBeat) {
      for (let i = 0; i < clockChannel.length; ++i) {
        let sample = clockChannel[i];
        let on = AppConfig.schmitt(this.clockOn, sample);
        if (on && !this.clockOn) {
          if (!this.externalClock) {
            this.externalClock = true;
            this.currentNote = 0;
          } else {
            this.currentNote = this.currentNote + 1;
          }
          this.takeStep(i, minOct, maxOct);
        }
        this.clockOn = on;
      }
    }

    if (this.syncToBeat || !this.externalClock) {
      let tMs = (currentTime + (this.clockSkew || 0)) * 1000;
      let raw = Math.floor(tMs / this.durationOfOneNote);
      if (raw !== this.lastBpmRaw) {
        this.lastBpmRaw = raw;
        this.currentNote = raw < 0 ? 0 : raw;
        this.takeStep(n - 1, minOct, maxOct);
      }
    }

    let hz = this.heldHz;
    if (this.pulseRemaining <= 0) {
      if (hzChannel) hzChannel.fill(hz);
      if (trigChannel) trigChannel.fill(0);
    } else {
      for (let i = 0; i < n; ++i) {
        if (hzChannel) hzChannel[i] = hz;
        if (trigChannel) {
          if (this.pulseRemaining > 0) {
            trigChannel[i] = 1;
            this.pulseRemaining--;
          } else {
            trigChannel[i] = 0;
          }
        }
      }
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("arpeggiator-worklet", ArpeggiatorWorklet);
