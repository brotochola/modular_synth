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

  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "kick808");
    this.prevTrig = 0;
    this.phase = 0;
    this.ampEnv = 0;
    this.pitchEnv = 0;
    this.clickEnv = 0;
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
    let clickAmt = parameters.click[0];
    let aTrig = trigs.length > 1;
    let trig0 = trigs[0];
    let twoPi = 6.283185307179586;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let pitchCoeff = Math.exp(-1 / (sampleRate * AppConfig.KICK_PITCH_ENV_SEC));
    let clickCoeff = Math.exp(-1 / (sampleRate * AppConfig.KICK_CLICK_ENV_SEC));
    let prev = this.prevTrig;
    let phase = this.phase;
    let ampEnv = this.ampEnv;
    let pitchEnv = this.pitchEnv;
    let clickEnv = this.clickEnv;
    let invSr = 1 / sampleRate;
    for (let i = 0; i < n; i++) {
      let trig = aTrig ? trigs[i] : trig0;
      if (AppConfig.isRising(prev, trig)) {
        phase = 0;
        ampEnv = 1;
        pitchEnv = 1;
        clickEnv = 1;
      }
      let freq = pitch + punch * pitchEnv;
      phase += freq * invSr;
      phase -= Math.floor(phase);
      let sine = Math.sin(phase * twoPi) * ampEnv;
      let click = (Math.random() * 2 - 1) * clickEnv * clickAmt;
      let out = sine + click;
      out = Math.tanh(out);
      output[i] = out;
      ampEnv *= ampCoeff;
      pitchEnv *= pitchCoeff;
      clickEnv *= clickCoeff;
      prev = trig;
    }
    this.prevTrig = prev;
    this.phase = phase;
    this.ampEnv = ampEnv;
    this.pitchEnv = pitchEnv;
    this.clickEnv = clickEnv;
    return true;
  }
}

registerProcessor("kick808-worklet", Kick808Worklet);
