class Clave808Worklet extends AudioWorkletProcessor {
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
        defaultValue: 2500,
        minValue: 800,
        maxValue: 5000,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.05,
        minValue: 0.015,
        maxValue: 0.25,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "clave808");
    this.trigOn = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastPitch = NaN;
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

  bake(pitch, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let invSr = 1 / sampleRate;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let dropSec = 0.018;
    let dropCoeff = Math.exp(-1 / (sampleRate * dropSec));
    let env = 1;
    let pitchEnv = 1;
    let ph = 0;
    let dest = this.lut;
    for (let i = 0; i < n; i++) {
      let freq = pitch * (1 + 0.12 * pitchEnv);
      ph += freq * invSr;
      ph -= ph | 0;
      let out = this.sineAt(ph) * env * 1.15;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      env *= ampCoeff;
      pitchEnv *= dropCoeff;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let pitch = parameters.pitch[0];
    let decay = parameters.decay[0];
    if (decay < 0.015) decay = 0.015;
    if (pitch !== this.lastPitch || decay !== this.lastDecay) {
      this.lastPitch = pitch;
      this.lastDecay = decay;
      this.bake(pitch, decay);
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

registerProcessor("clave808-worklet", Clave808Worklet);
