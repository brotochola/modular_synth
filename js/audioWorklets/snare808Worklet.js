class Snare808Worklet extends AudioWorkletProcessor {
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
        defaultValue: 185,
        minValue: 80,
        maxValue: 400,
        automationRate: "k-rate",
      },
      {
        name: "tone",
        defaultValue: 0.45,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "snappy",
        defaultValue: 0.7,
        minValue: 0,
        maxValue: 1,
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
    if (globalThis.AudioProfile) AudioProfile.attach(this, "snare808");
    this.trigOn = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastPitch = NaN;
    this.lastTone = NaN;
    this.lastSnappy = NaN;
    this.lastDecay = NaN;
    this.sineLut = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      this.sineLut[i] = Math.sin((i / 2048) * 6.283185307179586);
    }
  }

  sineAt(phase) {
    let idx = phase * 2048;
    let i0 = idx | 0;
    let f = idx - i0;
    let lut = this.sineLut;
    let s0 = lut[i0 & 2047];
    let s1 = lut[(i0 + 1) & 2047];
    return s0 + (s1 - s0) * f;
  }

  bake(pitch, tone, snappy, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let ratio = AppConfig.SNARE_RATIO;
    let f1 = pitch;
    let f2 = pitch * ratio;
    let g1 = 1 - tone;
    let g2 = tone;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let noiseDecay = decay * 0.45;
    if (noiseDecay < 0.02) noiseDecay = 0.02;
    let noiseCoeff = Math.exp(-Math.log(1000) / (noiseDecay * sampleRate));
    let env2Coeff = Math.exp(-Math.log(1000) / (decay * 0.55 * sampleRate));
    let hpK = 1 - Math.exp((-2 * Math.PI * 2000) / sampleRate);
    let invSr = 1 / sampleRate;
    let env = 1;
    let env2 = 1;
    let nenv = 1;
    let ph1 = 0;
    let ph2 = 0;
    let lp = 0;
    let noise = 1;
    let dest = this.lut;
    for (let i = 0; i < n; i++) {
      ph1 += f1 * invSr;
      ph1 -= ph1 | 0;
      ph2 += f2 * invSr;
      ph2 -= ph2 | 0;
      let s1 = this.sineAt(ph1) * env * g1;
      let s2 = this.sineAt(ph2) * env2 * g2;
      noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
      let nse = noise / 2147483648;
      lp += hpK * (nse - lp);
      let hp = (nse - lp) * nenv * snappy;
      let out = (s1 + s2) * 0.85 + hp * 0.9;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      env *= ampCoeff;
      env2 *= env2Coeff;
      nenv *= noiseCoeff;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let pitch = parameters.pitch[0];
    let tone = parameters.tone[0];
    let snappy = parameters.snappy[0];
    let decay = parameters.decay[0];
    if (decay < 0.05) decay = 0.05;
    if (
      pitch !== this.lastPitch ||
      tone !== this.lastTone ||
      snappy !== this.lastSnappy ||
      decay !== this.lastDecay
    ) {
      this.lastPitch = pitch;
      this.lastTone = tone;
      this.lastSnappy = snappy;
      this.lastDecay = decay;
      this.bake(pitch, tone, snappy, decay);
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

registerProcessor("snare808-worklet", Snare808Worklet);
