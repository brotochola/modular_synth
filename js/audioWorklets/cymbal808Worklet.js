class Cymbal808Worklet extends AudioWorkletProcessor {
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
        name: "decay",
        defaultValue: 1.2,
        minValue: 0.2,
        maxValue: 4,
        automationRate: "k-rate",
      },
      {
        name: "tone",
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
    if (globalThis.AudioProfile) AudioProfile.attach(this, "cymbal808");
    this.trigOn = 0;
    this.playhead = 1e9;
    this.lut = new Float32Array(0);
    this.lutLen = 0;
    this.lastTone = NaN;
    this.lastDecay = NaN;
  }

  bake(tone, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.lut.length < n) this.lut = new Float32Array(n);
    this.lutLen = n;
    let freqs = AppConfig.HAT_FREQS;
    let invSr = 1 / sampleRate;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let loHz = AppConfig.CYMBAL_BPF_LO;
    let hiHz = AppConfig.CYMBAL_BPF_HI;
    if (loHz < 40) loHz = 40;
    if (hiHz < 40) hiHz = 40;
    let fLo = 2 * Math.sin(Math.PI * loHz * invSr);
    let fHi = 2 * Math.sin(Math.PI * hiHz * invSr);
    let q = 0.22;
    let hpK = 1 - Math.exp((-2 * Math.PI * AppConfig.CYMBAL_HPF) / sampleRate);
    let gHi = tone;
    if (gHi < 0) gHi = 0;
    if (gHi > 1) gHi = 1;
    let gLo = 1 - gHi;
    let ph = [0, 0, 0, 0, 0, 0];
    let lowL = 0;
    let bandL = 0;
    let lowH = 0;
    let bandH = 0;
    let lp = 0;
    let env = 1;
    let nOsc = freqs.length;
    let dest = this.lut;
    for (let i = 0; i < n; i++) {
      let mix = 0;
      for (let o = 0; o < nOsc; o++) {
        ph[o] += freqs[o] * invSr;
        ph[o] -= ph[o] | 0;
        mix += ph[o] < 0.5 ? 1 : -1;
      }
      mix /= nOsc;
      let x = mix * env;
      lowL += fLo * bandL;
      let highL = x - lowL - q * bandL;
      bandL += fLo * highL;
      lowH += fHi * bandH;
      let highH = x - lowH - q * bandH;
      bandH += fHi * highH;
      let bpf = bandL * gLo + bandH * gHi;
      lp += hpK * (bpf - lp);
      let out = (bpf - lp) * 1.6;
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
    let tone = parameters.tone[0];
    let decay = parameters.decay[0];
    if (decay < 0.2) decay = 0.2;
    if (tone !== this.lastTone || decay !== this.lastDecay) {
      this.lastTone = tone;
      this.lastDecay = decay;
      this.bake(tone, decay);
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

registerProcessor("cymbal808-worklet", Cymbal808Worklet);
