class PolySequencerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "poly-sequencer");
    this.sequence = null;
    this.bpm = 120;
    this.durationOfOneNote = 0;
    this.durationOfLoop = 0;
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.externalClock = false;
    this.syncToBeat = false;
    this.prevClockSample = 0;
    this.clockSkew = 0;
    this.pulseLength = Math.max(1, Math.floor(sampleRate * 0.01));
    this.pulseRemaining = [0, 0, 0, 0, 0, 0, 0, 0];
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.clockSkew != null) this.clockSkew = d.clockSkew;
      if (d.seq != null) this.sequence = d.seq;
      if (d.syncToBeat != null) {
        this.syncToBeat = !!d.syncToBeat;
        if (this.syncToBeat) this.externalClock = false;
      }
      if (d.bpm != null) {
        this.bpm = d.bpm;
        this.durationOfOneNote = (60000 / this.bpm) * 0.25;
        this.durationOfLoop = this.durationOfOneNote * 16;
      }
    };
  }

  postPlayhead() {
    if (this.currentNote === this.lastPostedNote) return;
    this.armPulses(this.currentNote);
    this.lastPostedNote = this.currentNote;
    this.port.postMessage({ currentNote: this.currentNote });
  }

  armPulses(step) {
    let seq = this.sequence;
    if (!seq || !seq[step]) return;
    for (let lane = 0; lane < 8; lane++) {
      if (seq[step][lane]) this.pulseRemaining[lane] = this.pulseLength;
    }
  }

  process(inputs, outputs) {
    let seq = this.sequence;
    if (!seq || !this.durationOfLoop) return true;
    let clockChannel = inputs[0] && inputs[0][0];
    let n = 128;
    for (let o = 0; o < outputs.length; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (ch && ch.length > n) n = ch.length;
    }

    if (clockChannel && !this.syncToBeat) {
      for (let i = 0; i < clockChannel.length; ++i) {
        let sample = clockChannel[i];
        if (sample > this.prevClockSample + 0.01) {
          if (!this.externalClock) {
            this.externalClock = true;
            this.currentNote = 0;
          } else {
            this.currentNote = (this.currentNote + 1) % 16;
          }
          this.postPlayhead();
        }
        this.prevClockSample = sample;
        this.writeStep(outputs, i);
      }
      return true;
    }

    if (this.syncToBeat || !this.externalClock) {
      let tMs = (currentTime + (this.clockSkew || 0)) * 1000;
      let phase =
        ((tMs % this.durationOfLoop) + this.durationOfLoop) %
        this.durationOfLoop;
      this.currentNote = Math.floor(phase / this.durationOfOneNote);
      this.postPlayhead();
    }

    let ch0 = outputs[0] && outputs[0][0];
    n = ch0 ? ch0.length : n;
    for (let i = 0; i < n; i++) this.writeStep(outputs, i);
    return true;
  }

  writeStep(outputs, i) {
    for (let lane = 0; lane < 8; lane++) {
      let ch = outputs[lane] && outputs[lane][0];
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
