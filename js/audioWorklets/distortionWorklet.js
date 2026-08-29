class DistortionWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "amount",
        defaultValue: 10,
        minValue: 0,
        maxValue: 100,
        automationRate: "a-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "distortion");
    this.lut = new Float32Array(4096);
    this.lutAmt = -1;
  }

  rebuildLut(amt) {
    let lut = this.lut;
    let n = lut.length;
    let last = n - 1;
    for (let i = 0; i < n; i++) {
      let x = (i / last) * 2 - 1;
      lut[i] = (1 / (1 + Math.exp(amt * x)) - 0.5) * 2;
    }
    this.lutAmt = amt;
  }

  process(inputs, outputs, parameters) {
    let out = outputs[0] && outputs[0][0];
    let inp = inputs[0] && inputs[0][0];
    if (!out) return true;
    let n = out.length;
    let amts = parameters.amount;
    let amt0 = amts[0];
    let aRate = amts.length > 1;
    if (!aRate) {
      if (amt0 !== this.lutAmt) this.rebuildLut(amt0);
      let lut = this.lut;
      let last = lut.length - 1;
      if (inp) {
        for (let i = 0; i < n; i++) {
          let x = inp[i];
          if (x < -1) x = -1;
          else if (x > 1) x = 1;
          let idx = ((x + 1) * 0.5) * last;
          let i0 = idx | 0;
          let f = idx - i0;
          let a = lut[i0];
          let b = lut[i0 < last ? i0 + 1 : last];
          out[i] = a + (b - a) * f;
        }
      } else {
        out.fill(0);
      }
    } else if (inp) {
      for (let i = 0; i < n; i++) {
        out[i] = (1 / (1 + Math.exp(amts[i] * inp[i])) - 0.5) * 2;
      }
    } else {
      out.fill(0);
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("distortion-worklet", DistortionWorklet);
