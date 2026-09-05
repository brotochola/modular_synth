class Clap808Worklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "trigger",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
      {
        name: "tone",
        defaultValue: 1000,
        minValue: 400,
        maxValue: 3000,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.35,
        minValue: 0.05,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "snap",
        defaultValue: 0.75,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "clap808");
    this.trigOn = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastTone = NaN;
    this.lastDecay = NaN;
    this.lastSnap = NaN;
  }

  bake(tone, decay, snap) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let p0 = (AppConfig.CLAP_PULSE0_SEC * sampleRate) | 0;
    let p1 = (AppConfig.CLAP_PULSE1_SEC * sampleRate) | 0;
    let p2 = (AppConfig.CLAP_PULSE2_SEC * sampleRate) | 0;
    let p3 = (AppConfig.CLAP_PULSE3_SEC * sampleRate) | 0;
    let burstCoeff = Math.exp(-1 / (AppConfig.CLAP_BURST_SEC * sampleRate));
    let tailCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let freq = tone;
    if (freq < 40) freq = 40;
    if (freq > sampleRate * 0.45) freq = sampleRate * 0.45;
    let f = 2 * Math.sin(Math.PI * freq * (1 / sampleRate));
    let q = 0.35;
    let low = 0;
    let band = 0;
    let burstEnv = 0;
    let tailEnv = 1;
    let noise = 1;
    let dest = this.lut;
    let tailAmt = 0.22 + 0.55 * (1 - snap);
    for (let i = 0; i < n; i++) {
      if (i === p0 || i === p1 || i === p2 || i === p3) burstEnv = 1;
      noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
      let nse = noise / 2147483648;
      let env = burstEnv * snap + tailEnv * tailAmt;
      let x = nse * env;
      low += f * band;
      let high = x - low - q * band;
      band += f * high;
      let out = band * 1.8;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      burstEnv *= burstCoeff;
      tailEnv *= tailCoeff;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let tone = parameters.tone[0];
    let decay = parameters.decay[0];
    let snap = parameters.snap[0];
    if (decay < 0.05) decay = 0.05;
    if (
      tone !== this.lastTone ||
      decay !== this.lastDecay ||
      snap !== this.lastSnap
    ) {
      this.lastTone = tone;
      this.lastDecay = decay;
      this.lastSnap = snap;
      this.bake(tone, decay, snap);
    }
    let trigs = parameters.trigger;
    let aTrig = trigs.length > 1;
    let trig0 = trigs[0];
    let prev = this.trigOn;
    let play = this.playhead;
    let lut = this.lut;
    let len = this.lutLen;
    let n = output.length;
    for (let i = 0; i < n; i++) {
      let trig = aTrig ? trigs[i] : trig0;
      let on = AppConfig.schmitt(prev, trig);
      if (on && !prev) play = 0;
      output[i] = play < len ? lut[play++] : 0;
      prev = on;
    }
    this.trigOn = prev;
    this.playhead = play;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("clap808-worklet", Clap808Worklet);
