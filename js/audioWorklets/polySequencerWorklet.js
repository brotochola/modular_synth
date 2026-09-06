class PolySequencerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "poly-sequencer");
    this.sequence = null;
    this.nSteps = AppConfig.SEQ_STEPS;
    this.bpm = 0;
    this.durationOfOneNote = 0;
    this.durationOfLoop = 0;
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.externalClock = false;
    this.syncToBeat = false;
    this.clockOn = 0;
    this.clockSkew = 0;
    this.pulseLength = AppConfig.trigPulseSamples(sampleRate);
    this.pulseRemaining = [0, 0, 0, 0, 0, 0, 0, 0];
    this.outCh = new Array(8);
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.seq != null) {
        this.sequence = d.seq;
        this.nSteps = d.seq.length || this.nSteps;
      }
      if (d.steps != null) {
        let n = Math.round(Number(d.steps));
        if (n > 0) this.nSteps = n;
      }
      this.applyBpm(this.bpm, true);
    };
    this.applyBpm(AppConfig.FALLBACK_BPM, true);
  }

  applyBpm(bpm, force) {
    if (!(bpm > 0)) return;
    if (!force && bpm === this.bpm && this.durationOfLoop) return;
    this.bpm = bpm;
    this.durationOfOneNote = (60000 / bpm) * AppConfig.SEQ_STEP_QUARTER;
    this.durationOfLoop = this.durationOfOneNote * (this.nSteps || 16);
  }

  readControl() {
    let sab = this.sab;
    if (!sab) return;
    this.applyBpm(sab.getBpm());
    this.clockSkew = sab.getSlot(0);
    this.syncToBeat = sab.getSlot(1) > 0.5;
    let steps = sab.getSlot(2);
    if (steps >= 16) {
      let n = Math.round(steps);
      if (n !== this.nSteps) {
        this.nSteps = n;
        this.applyBpm(this.bpm, true);
      }
    }
    if (this.syncToBeat) this.externalClock = false;
  }

  postPlayhead() {
    if (this.currentNote === this.lastPostedNote) return;
    this.armPulses(this.currentNote);
    this.lastPostedNote = this.currentNote;
    if (this.sab) this.sab.setNote(this.currentNote);
  }

  armPulses(step) {
    let seq = this.sequence;
    if (!seq || !seq[step]) return;
    for (let lane = 0; lane < 8; lane++) {
      if (seq[step][lane]) this.pulseRemaining[lane] = this.pulseLength;
    }
  }

  process(inputs, outputs) {
    this.readControl();
    if (!this.durationOfLoop) return true;
    let nSteps = this.nSteps || 16;
    let clockChannel = inputs[0] && inputs[0][0];
    let n = 128;
    for (let o = 0; o < 8; o++) {
      this.outCh[o] = outputs[o] && outputs[o][0];
      let ch = this.outCh[o];
      if (ch && ch.length > n) n = ch.length;
    }

    if (clockChannel && clockChannel.length && !this.syncToBeat) {
      for (let i = 0; i < clockChannel.length; ++i) {
        let sample = clockChannel[i];
        let on = AppConfig.schmitt(this.clockOn, sample);
        if (on && !this.clockOn) {
          if (!this.externalClock) {
            this.externalClock = true;
            this.currentNote = 0;
          } else {
            this.currentNote = (this.currentNote + 1) % nSteps;
          }
          this.postPlayhead();
        }
        this.clockOn = on;
      }
    }

    if (this.syncToBeat || !this.externalClock) {
      let tMs = (currentTime + (this.clockSkew || 0)) * 1000;
      let phase =
        ((tMs % this.durationOfLoop) + this.durationOfLoop) %
        this.durationOfLoop;
      this.currentNote = Math.floor(phase / this.durationOfOneNote) % nSteps;
      this.postPlayhead();
    }

    for (let i = 0; i < n; i++) this.writeStep(i);
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }

  writeStep(i) {
    for (let lane = 0; lane < 8; lane++) {
      let ch = this.outCh[lane];
      if (!ch || i >= ch.length) continue;
      if (this.pulseRemaining[lane] > 0) {
        ch[i] = 1;
        this.pulseRemaining[lane]--;
      } else {
        ch[i] = 0;
      }
    }
  }
}

registerProcessor("poly-sequencer-worklet", PolySequencerWorklet);
