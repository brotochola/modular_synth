class PadSamplerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioBuffer = [];
    this.port.onmessage = (e) => {
      if (e.data.audioBuffer) {
        this.audioBuffer = [
          ...e.data.audioBuffer,
          ...e.data.audioBuffer.reverse(),
        ];
        console.log("updated worklet's audio buffer", this.audioBuffer);
      }
    };

    this.state = [];
  }
  getNextSample() {
    let val = 0;
    let purgedArr = this.state.filter((k) => k.speed);
    for (let c of purgedArr) {
      c.idx += c.speed;
      if (c.idx > this.audioBuffer.length) {
        c.idx = 0;
      } else if (c.idx < 0) {
        c.idx = this.audioBuffer.length - 1;
      }
      val += this.audioBuffer[Math.floor(c.idx)];
    }

    return val / purgedArr.length;
  }

  process(inputs, outputs) {
    let output = ((outputs || [])[0] || [])[0] || [];
    // let input1 = (((inputs || [])[0] || [])[0] || [])[0] || 1;
    // let input2 = (((inputs || [])[1] || [])[0] || [])[0] || 1;

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

    try {
      if (this.audioBuffer.length) {
        for (let i = 0; i < output.length; i++) {
          output[i] = this.getNextSample();
        }
      }
    } catch (e) {
      this.port.postMessage({ error: e });
      console.warn(e);
    }
    return true;
  }
}

registerProcessor("pad-sampler", PadSamplerWorklet);
