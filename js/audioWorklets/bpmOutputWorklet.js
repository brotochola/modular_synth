class BpmOutWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bpm = 120;
    this.rate = 1;
    this.count = 0;
    this.lastCount = -1;
    this.pulseRemaining = 0;
    this.pulseLength = Math.max(1, Math.floor(sampleRate * 0.002));
    this.port.onmessage = (e) => {
      if (e.data.bpm) this.bpm = e.data.bpm;
      if (e.data.rate != null) this.rate = e.data.rate;
    };
  }

  process(inputs, outputs) {
    try {
      let output = ((outputs || [])[0] || [])[0];
      if (!output) return true;
      let rate = this.rate || 1;
      this.count = Math.floor(currentTime * (this.bpm / 60) * rate);
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
