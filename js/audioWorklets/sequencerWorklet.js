class SequencerWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "baseHz",
        defaultValue: 440,
        minValue: 0.01,
        maxValue: 20000,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sequencer");
    this.sequence = null;
    this.bpm = 120;
    this.durationOfOneNote = 0;
    this.durationOfLoop = 0;
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.lastStepForTrig = -1;
    this.externalClock = false;
    this.syncToBeat = false;
    this.prevClockSample = 0;
    this.clockSkew = 0;
    this.pulseRemaining = 0;
    this.pulseLength = Math.max(1, Math.floor(sampleRate * 0.01));
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
    this.lastPostedNote = this.currentNote;
    this.port.postMessage({ currentNote: this.currentNote });
  }

  armTrigIfNeeded(seq) {
    if (this.currentNote === this.lastStepForTrig) return;
    this.lastStepForTrig = this.currentNote;
    if (seq[this.currentNote]) this.pulseRemaining = this.pulseLength;
  }

  process(inputs, outputs, parameters) {
    let seq = this.sequence;
    if (!seq || !this.durationOfLoop) return true;
    let outputChannel = outputs[0] && outputs[0][0];
    let gateChannel = outputs[1] && outputs[1][0];
    let hzChannel = outputs[2] && outputs[2][0];
    let trigChannel = outputs[3] && outputs[3][0];
    if (!outputChannel) return true;
    let n = outputChannel.length;
    let clockChannel = inputs[0] && inputs[0][0];

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
      }
    }

    if (this.syncToBeat || !this.externalClock) {
      let tMs = (currentTime + (this.clockSkew || 0)) * 1000;
      let phase =
        ((tMs % this.durationOfLoop) + this.durationOfLoop) % this.durationOfLoop;
      this.currentNote = Math.floor(phase / this.durationOfOneNote);
      this.postPlayhead();
    }

    this.armTrigIfNeeded(seq);

    let pitch = seq[this.currentNote] || 0;
    let gate = pitch != 0 ? 1 : 0;
    let baseArr = parameters.baseHz;
    let base0 = baseArr[0];
    let aRate = baseArr.length > 1;
    for (let i = 0; i < n; ++i) {
      outputChannel[i] = pitch;
      if (hzChannel) {
        hzChannel[i] = pitch * (aRate ? baseArr[i] : base0);
      }
      if (gateChannel) gateChannel[i] = gate;
      if (trigChannel) {
        if (this.pulseRemaining > 0) {
          trigChannel[i] = 1;
          this.pulseRemaining--;
        } else {
          trigChannel[i] = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("sequencer-worklet", SequencerWorklet);
