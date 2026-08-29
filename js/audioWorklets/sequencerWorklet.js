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

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sequencer");
    this.sequence = new Float32Array(AppConfig.SEQ_STEPS);
    this.bpm = 0;
    this.durationOfOneNote = 0;
    this.durationOfLoop = 0;
    this.applyBpm(AppConfig.FALLBACK_BPM);
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.lastStepForTrig = -1;
    this.externalClock = false;
    this.syncToBeat = false;
    this.prevClockSample = 0;
    this.clockSkew = 0;
    this.pulseRemaining = 0;
    this.pulseLength = AppConfig.trigPulseSamples(sampleRate);
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.seq != null) {
        for (let i = 0; i < AppConfig.SEQ_STEPS; i++) {
          this.sequence[i] = d.seq[i] || 0;
        }
      }
    };
  }

  applyBpm(bpm) {
    if (!(bpm > 0)) return;
    if (bpm === this.bpm && this.durationOfLoop) return;
    this.bpm = bpm;
    this.durationOfOneNote = (60000 / bpm) * AppConfig.SEQ_STEP_QUARTER;
    this.durationOfLoop = this.durationOfOneNote * AppConfig.SEQ_STEPS;
  }

  readControl() {
    let sab = this.sab;
    if (!sab) return;
    this.applyBpm(sab.getBpm());
    this.clockSkew = sab.getSlot(16);
    this.syncToBeat = sab.getSlot(17) > 0.5;
    if (this.syncToBeat) this.externalClock = false;
    if (sab.getSlot(18) < 0.5) return;
    for (let i = 0; i < AppConfig.SEQ_STEPS; i++) {
      this.sequence[i] = sab.getSlot(i);
    }
  }

  postPlayhead() {
    if (this.currentNote === this.lastPostedNote) return;
    this.lastPostedNote = this.currentNote;
    if (this.sab) this.sab.setNote(this.currentNote);
  }

  armTrigIfNeeded(seq) {
    if (this.currentNote === this.lastStepForTrig) return;
    this.lastStepForTrig = this.currentNote;
    if (seq[this.currentNote]) this.pulseRemaining = this.pulseLength;
  }

  process(inputs, outputs, parameters) {
    this.readControl();
    if (!this.durationOfLoop) return true;
    let seq = this.sequence;
    let outputChannel = outputs[0] && outputs[0][0];
    let gateChannel = outputs[1] && outputs[1][0];
    let hzChannel = outputs[2] && outputs[2][0];
    let trigChannel = outputs[3] && outputs[3][0];
    let n =
      (outputChannel && outputChannel.length) ||
      (gateChannel && gateChannel.length) ||
      (hzChannel && hzChannel.length) ||
      (trigChannel && trigChannel.length) ||
      128;
    let clockChannel = inputs[0] && inputs[0][0];

    if (clockChannel && clockChannel.length && !this.syncToBeat) {
      for (let i = 0; i < clockChannel.length; ++i) {
        let sample = clockChannel[i];
        if (AppConfig.isRising(this.prevClockSample, sample)) {
          if (!this.externalClock) {
            this.externalClock = true;
            this.currentNote = 0;
          } else {
            this.currentNote = (this.currentNote + 1) % AppConfig.SEQ_STEPS;
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
    if (this.pulseRemaining <= 0 && !aRate) {
      if (outputChannel) outputChannel.fill(pitch);
      if (hzChannel) hzChannel.fill(pitch * base0);
      if (gateChannel) gateChannel.fill(gate);
      if (trigChannel) trigChannel.fill(0);
    } else {
      for (let i = 0; i < n; ++i) {
        if (outputChannel) outputChannel[i] = pitch;
        if (hzChannel) hzChannel[i] = pitch * (aRate ? baseArr[i] : base0);
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
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("sequencer-worklet", SequencerWorklet);
