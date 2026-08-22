class PadSamplerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioBuffer = new Float32Array(0);
    this.port.onmessage = (e) => {
      let src = e.data && e.data.audioBuffer;
      if (!src || !src.length) return;
      let n = src.length;
      let buf = new Float32Array(n * 2);
      buf.set(src);
      for (let i = 0; i < n; i++) buf[n + i] = src[n - 1 - i];
      this.audioBuffer = buf;
    };

    this.state = [];
  }
  getNextSample() {
    let val = 0;
    let purgedArr = this.state.filter((k) => k.speed);
    let len = this.audioBuffer.length;
    for (let c of purgedArr) {
      c.idx += c.speed;
      if (c.idx > len) {
        c.idx = 0;
      } else if (c.idx < 0) {
        c.idx = len - 1;
      }
      val += this.audioBuffer[Math.floor(c.idx)];
    }

    return val / purgedArr.length;
  }

  process(inputs, outputs) {
    let output = ((outputs || [])[0] || [])[0] || [];

    for (let i = 0; i < (inputs || []).length; i++) {
      let inputVal = ((inputs[i] || [])[0] || [])[0] || 0;
      if (!this.state[i]) {
        this.state[i] = { speed: 1, idx: 0 };
      }
      this.state[i].speed = inputVal;
      if (inputVal == 0) {
        this.state[i].idx = 0;
      }
    }

    if (this.audioBuffer.length) {
      for (let i = 0; i < output.length; i++) {
        output[i] = this.getNextSample();
      }
    }
    return true;
  }
}

registerProcessor("pad-sampler", PadSamplerWorklet);
