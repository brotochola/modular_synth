class Cowbell808Worklet extends AudioWorkletProcessor {
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
        name: "pitch",
        defaultValue: 540,
        minValue: 200,
        maxValue: 1200,
        automationRate: "k-rate",
      },
      {
        name: "tone",
        defaultValue: 900,
        minValue: 400,
        maxValue: 3000,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.18,
        minValue: 0.05,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "cowbell808");
    this.prevTrig = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastPitch = NaN;
    this.lastTone = NaN;
    this.lastDecay = NaN;
  }

  bake(pitch, tone, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let f1 = pitch;
    let f2 = pitch * AppConfig.COWBELL_RATIO;
    let invSr = 1 / sampleRate;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let freq = tone;
    if (freq < 40) freq = 40;
    if (freq > sampleRate * 0.45) freq = sampleRate * 0.45;
    let f = 2 * Math.sin(Math.PI * freq * invSr);
    let q = 0.28;
    let low = 0;
    let band = 0;
    let ph1 = 0;
    let ph2 = 0;
    let env = 1;
    let dest = this.lut;
    for (let i = 0; i < n; i++) {
      ph1 += f1 * invSr;
      ph1 -= ph1 | 0;
      ph2 += f2 * invSr;
      ph2 -= ph2 | 0;
      let sq = (ph1 < 0.5 ? 1 : -1) * 0.55 + (ph2 < 0.5 ? 1 : -1) * 0.45;
      let x = sq * env;
      low += f * band;
      let high = x - low - q * band;
      band += f * high;
      let out = band * 1.6;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      env *= ampCoeff;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let pitch = parameters.pitch[0];
    let tone = parameters.tone[0];
    let decay = parameters.decay[0];
    if (decay < 0.05) decay = 0.05;
    if (
      pitch !== this.lastPitch ||
      tone !== this.lastTone ||
      decay !== this.lastDecay
    ) {
      this.lastPitch = pitch;
      this.lastTone = tone;
      this.lastDecay = decay;
      this.bake(pitch, tone, decay);
    }
    let trigs = parameters.trigger;
    let aTrig = trigs.length > 1;
    let trig0 = trigs[0];
    let prev = this.prevTrig;
    let play = this.playhead;
    let lut = this.lut;
    let len = this.lutLen;
    let thr = AppConfig.TRIG_THRESHOLD;
    let n = output.length;
    for (let i = 0; i < n; i++) {
      let trig = aTrig ? trigs[i] : trig0;
      if (prev < thr && trig >= thr) play = 0;
      output[i] = play < len ? lut[play++] : 0;
      prev = trig;
    }
    this.prevTrig = prev;
    this.playhead = play;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("cowbell808-worklet", Cowbell808Worklet);
