class LerpProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastValue = 0;
    this.time = 0.5;
    this.port.onmessage = (e) => {
      this.time = Math.abs(e.data.time);
      if (this.time == 0 || isNaN(this.time)) {
        this.time = 0.5;
      } else if (this.time < 0.0001) {
        this.time = 0.0001;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let last = this.lastValue;
    let t = this.time;
    if (input) {
      for (let i = 0; i < n; i++) {
        last = last + ((input[i] - last) * 0.0001) / t;
        output[i] = last;
      }
    } else {
      for (let i = 0; i < n; i++) output[i] = last;
    }
    this.lastValue = last;
    return true;
  }
}

registerProcessor("lerp-processor", LerpProcessor);
