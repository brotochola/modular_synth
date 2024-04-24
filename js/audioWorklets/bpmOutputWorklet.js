class BpmOutWorklet extends AudioWorkletProcessor {
  constructor() {
    super();

    this.port.onmessage = (e) => {
      if (e.data.bpm) {
        this.bpm = e.data.bpm;
      }
      this.port.postMessage({ data: e.data });
    };
    this.count = 0;
  }

  process(inputs, outputs, parameters) {
    try {
      let output = ((outputs || [])[0] || [])[0];
      this.count = Math.floor(currentTime / (60 / this.bpm));
      if (this.count != this.lastCount) {
        this.port.postMessage({ count: this.count });
        this.lastCount = this.count;
      }
      
      for (let i = 0; i < output.length; ++i) {
        output[i] = this.count;
      }
    } catch (e) {
      this.port.postMessage(e);
    }

    return true;
  }
}

registerProcessor("bpm-worklet", BpmOutWorklet);
