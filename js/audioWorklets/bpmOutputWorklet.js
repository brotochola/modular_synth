class BpmOutWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "bpm");
    this.bpm = 120;
    this.rate = 1;
    this.count = 0;
    this.lastCount = -1;
    this.pulseRemaining = 0;
    this.pulseLength = AppConfig.trigPulseSamples(sampleRate);
    this.clockSkew = 0;
  }

  process(inputs, outputs) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let sab = this.sab;
    if (sab) {
      let bpm = sab.getBpm();
      if (bpm > 0) this.bpm = bpm;
      let rate = sab.getRate();
      if (rate > 0) this.rate = rate;
      this.clockSkew = sab.getSlot(0);
    }
    let t = currentTime + (this.clockSkew || 0);
    this.count = Math.floor(t * (this.bpm / 60) * (this.rate || 1));
    if (this.count != this.lastCount) {
      this.pulseRemaining = this.pulseLength;
      if (sab) sab.setNote(this.count);
      this.lastCount = this.count;
    }
    let n = output.length;
    if (this.pulseRemaining <= 0) {
      output.fill(0);
    } else {
      for (let i = 0; i < n; ++i) {
        if (this.pulseRemaining > 0) {
          output[i] = 1;
          this.pulseRemaining--;
        } else {
          output[i] = 0;
        }
      }
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("bpm-worklet", BpmOutWorklet);
