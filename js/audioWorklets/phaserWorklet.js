class PhaserWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "rate",
        defaultValue: 0.4,
        minValue: 0.01,
        maxValue: 10,
        automationRate: "k-rate",
      },
      {
        name: "depth",
        defaultValue: 0.7,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "feedback",
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 0.95,
        automationRate: "k-rate",
      },
      {
        name: "mix",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "phaser");
    this.phase = 0;
    this.xHist = [0, 0, 0, 0, 0, 0];
    this.yHist = [0, 0, 0, 0, 0, 0];
    this.lastOut = 0;
  }

  process(inputs, outputs, parameters) {
    let out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let inp = inputs[0] && inputs[0][0];
    let n = out.length;
    if (!inp) {
      out.fill(0);
      if (this.sab) {
        AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
        this.sab.publish();
      }
      return true;
    }
    let rate = parameters.rate[0];
    if (rate < 0.01) rate = 0.01;
    let depth = parameters.depth[0];
    if (depth < 0) depth = 0;
    if (depth > 1) depth = 1;
    let fb = parameters.feedback[0];
    if (fb < 0) fb = 0;
    if (fb > 0.95) fb = 0.95;
    let mix = parameters.mix[0];
    if (mix < 0) mix = 0;
    if (mix > 1) mix = 1;
    let dryMix = 1 - mix;
    let phase = this.phase;
    let dPhase = rate / sampleRate;
    let xHist = this.xHist;
    let yHist = this.yHist;
    let lastOut = this.lastOut;
    let minF = 200;
    let maxF = 1600;
    let logSpan = Math.log(maxF / minF);
    for (let i = 0; i < n; i++) {
      let lfo = Math.sin(phase * 6.283185307179586);
      phase += dPhase;
      phase -= phase | 0;
      let fc = minF * Math.exp(logSpan * (0.5 + 0.5 * lfo * depth));
      let tw = Math.tan((Math.PI * fc) / sampleRate);
      let a = (1 - tw) / (1 + tw);
      let x = inp[i] + lastOut * fb;
      for (let s = 0; s < 6; s++) {
        let y = a * x + xHist[s] - a * yHist[s];
        xHist[s] = x;
        yHist[s] = y;
        x = y;
      }
      lastOut = x;
      out[i] = dryMix * inp[i] + mix * x;
    }
    this.phase = phase;
    this.lastOut = lastOut;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("phaser-worklet", PhaserWorklet);
