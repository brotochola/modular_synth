class Kick808Worklet extends AudioWorkletProcessor {
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
        defaultValue: 50,
        minValue: 20,
        maxValue: 120,
        automationRate: "k-rate",
      },
      {
        name: "punch",
        defaultValue: 400,
        minValue: 0,
        maxValue: 2000,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.45,
        minValue: 0.05,
        maxValue: 2,
        automationRate: "k-rate",
      },
      {
        name: "click",
        defaultValue: 0.35,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "kick808");
    this.trigOn = 0;
    this.phase = 0;
    this.ampEnv = 0;
    this.pitchEnv = 0;
    this.clickEnv = 0;
    this.noise = 1;
    this.lastDecay = -1;
    this.ampCoeff = 0;
    this.sineLut = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      this.sineLut[i] = Math.sin((i / 2048) * 6.283185307179586);
    }
    this.pitchCoeff = Math.exp(-1 / (sampleRate * AppConfig.KICK_PITCH_ENV_SEC));
    this.clickCoeff = Math.exp(-1 / (sampleRate * AppConfig.KICK_CLICK_ENV_SEC));
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let trigs = parameters.trigger;
    let pitch = parameters.pitch[0];
    let punch = parameters.punch[0];
    let decay = parameters.decay[0];
    if (decay < 0.05) decay = 0.05;
    if (decay !== this.lastDecay) {
      this.lastDecay = decay;
      this.ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    }
    let clickAmt = parameters.click[0];
    let aTrig = trigs.length > 1;
    let trig0 = trigs[0];
    let lut = this.sineLut;
    let lutMask = 2047;
    let prev = this.trigOn;
    let phase = this.phase;
    let ampEnv = this.ampEnv;
    let pitchEnv = this.pitchEnv;
    let clickEnv = this.clickEnv;
    let noise = this.noise;
    let invSr = 1 / sampleRate;
    let ampCoeff = this.ampCoeff;
    let pitchCoeff = this.pitchCoeff;
    let clickCoeff = this.clickCoeff;
    for (let i = 0; i < n; i++) {
      let trig = aTrig ? trigs[i] : trig0;
      let on = AppConfig.schmitt(prev, trig);
      if (on && !prev) {
        phase = 0;
        ampEnv = 1;
        pitchEnv = 1;
        clickEnv = 1;
      }
      prev = on;
      let freq = pitch + punch * pitchEnv;
      phase += freq * invSr;
      phase -= phase | 0;
      let idx = phase * 2048;
      let i0 = idx | 0;
      let f = idx - i0;
      let s0 = lut[i0 & lutMask];
      let s1 = lut[(i0 + 1) & lutMask];
      let sine = (s0 + (s1 - s0) * f) * ampEnv;
      noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
      let click = (noise / 2147483648) * clickEnv * clickAmt;
      let out = sine + click;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      output[i] = out;
      ampEnv *= ampCoeff;
      pitchEnv *= pitchCoeff;
      clickEnv *= clickCoeff;
    }
    this.trigOn = prev;
    this.phase = phase;
    this.ampEnv = ampEnv;
    this.pitchEnv = pitchEnv;
    this.clickEnv = clickEnv;
    this.noise = noise;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("kick808-worklet", Kick808Worklet);
