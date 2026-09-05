class Rim808Worklet extends AudioWorkletProcessor {
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
        defaultValue: 455,
        minValue: 200,
        maxValue: 900,
        automationRate: "k-rate",
      },
      {
        name: "snap",
        defaultValue: 0.55,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.08,
        minValue: 0.02,
        maxValue: 0.4,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "rim808");
    this.trigOn = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastPitch = NaN;
    this.lastSnap = NaN;
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

  bake(pitch, snap, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let f1 = pitch;
    let ratio = AppConfig.RIM_FREQ_HI / AppConfig.RIM_FREQ_LO;
    let f2 = pitch * ratio;
    let invSr = 1 / sampleRate;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let clickCoeff = Math.exp(-1 / (sampleRate * AppConfig.KICK_CLICK_ENV_SEC));
    let env = 1;
    let clickEnv = 1;
    let ph1 = 0;
    let ph2 = 0;
    let noise = 1;
    let dest = this.lut;
    for (let i = 0; i < n; i++) {
      ph1 += f1 * invSr;
      ph1 -= ph1 | 0;
      ph2 += f2 * invSr;
      ph2 -= ph2 | 0;
      let body = this.sineAt(ph1) * 0.55 + this.sineAt(ph2) * 0.45;
      noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
      let click = (noise / 2147483648) * clickEnv * snap;
      let out = (body * env + click) * 1.35;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      env *= ampCoeff;
      clickEnv *= clickCoeff;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let pitch = parameters.pitch[0];
    let snap = parameters.snap[0];
    let decay = parameters.decay[0];
    if (decay < 0.02) decay = 0.02;
    if (
      pitch !== this.lastPitch ||
      snap !== this.lastSnap ||
      decay !== this.lastDecay
    ) {
      this.lastPitch = pitch;
      this.lastSnap = snap;
      this.lastDecay = decay;
      this.bake(pitch, snap, decay);
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

registerProcessor("rim808-worklet", Rim808Worklet);
