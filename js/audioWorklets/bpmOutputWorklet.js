class BpmOutWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "bpm");
    this.bpm = 120;
    this.rate = 1;
    this.count = 0;
    this.lastCount = -1;
    this.pulseRemaining = 0;
    this.pulseLength = AppConfig.trigPulseSamples(sampleRate);
    this.clockSkew = 0;
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.bpm) this.bpm = d.bpm;
      if (d.rate != null) this.rate = d.rate;
      if (d.clockSkew != null) this.clockSkew = d.clockSkew;
    };
  }

  process(inputs, outputs) {
    try {
      let output = ((outputs || [])[0] || [])[0];
      if (!output) return true;
      let rate = this.rate || 1;
      let t = currentTime + (this.clockSkew || 0);
      this.count = Math.floor(t * (this.bpm / 60) * rate);
      if (this.count != this.lastCount) {
        this.pulseRemaining = this.pulseLength;
        this.port.postMessage({ count: this.count });
        this.lastCount = this.count;
      }
      for (let i = 0; i < output.length; ++i) {
        if (this.pulseRemaining > 0) {
          output[i] = 1;
          this.pulseRemaining--;
        } else {
          output[i] = 0;
        }
      }
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("bpm-worklet", BpmOutWorklet);
