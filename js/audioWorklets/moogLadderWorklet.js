class MoogLadderWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "cutoff",
        defaultValue: 1000,
        minValue: 20,
        maxValue: 18000,
        automationRate: "a-rate",
      },
      {
        name: "res",
        defaultValue: 0.3,
        minValue: 0,
        maxValue: 1.1,
        automationRate: "k-rate",
      },
      {
        name: "drive",
        defaultValue: 1,
        minValue: 0.1,
        maxValue: 4,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "moog-ladder");
    this.y1 = 0;
    this.y2 = 0;
    this.y3 = 0;
    this.y4 = 0;
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
    let cuts = parameters.cutoff;
    let aCut = cuts.length > 1;
    let cut0 = cuts[0];
    let res = parameters.res[0];
    if (res < 0) res = 0;
    if (res > 1.1) res = 1.1;
    let drive = parameters.drive[0];
    if (drive < 0.1) drive = 0.1;
    let k = res * 4;
    let y1 = this.y1;
    let y2 = this.y2;
    let y3 = this.y3;
    let y4 = this.y4;
    let nyq = sampleRate * 0.45;
    for (let i = 0; i < n; i++) {
      let cutoff = aCut ? cuts[i] : cut0;
      if (cutoff < 20) cutoff = 20;
      if (cutoff > nyq) cutoff = nyq;
      // ponytail: no 2x oversample. Ceiling = alias at high cutoff. Upgrade = Huovilainen 2x.
      let g = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      let x = Math.tanh(drive * inp[i] - k * y4);
      y1 += g * (x - y1);
      y2 += g * (y1 - y2);
      y3 += g * (y2 - y3);
      y4 += g * (y3 - y4);
      out[i] = y4;
    }
    this.y1 = y1;
    this.y2 = y2;
    this.y3 = y3;
    this.y4 = y4;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("moog-ladder-worklet", MoogLadderWorklet);
