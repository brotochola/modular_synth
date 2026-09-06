class HandDrumWorklet extends AudioWorkletProcessor {
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
        name: "slap",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
      {
        name: "mute",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
      {
        name: "pitch",
        defaultValue: 180,
        minValue: 60,
        maxValue: 500,
        automationRate: "k-rate",
      },
      {
        name: "decay",
        defaultValue: 0.28,
        minValue: 0.05,
        maxValue: 0.8,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "hand-drum");
    this.trigOn = 0;
    this.slapOn = 0;
    this.muteOn = 0;
    this.playO = 1e9;
    this.playS = 1e9;
    this.playM = 1e9;
    this.openLut = new Float32Array(0);
    this.slapLut = new Float32Array(0);
    this.muteLut = new Float32Array(0);
    this.openLen = 0;
    this.slapLen = 0;
    this.muteLen = 0;
    this.lastPitch = NaN;
    this.lastDecay = NaN;
    this.sineLut = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      this.sineLut[i] = Math.sin((i / 2048) * 6.283185307179586);
    }
    this.rng = 123456789;
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

  noise() {
    let x = this.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return (this.rng / 4294967295) * 2 - 1;
  }

  clip(out) {
    if (out > 1) return 1;
    if (out < -1) return -1;
    return out / (1 + (out < 0 ? -out : out));
  }

  bake(pitch, decay) {
    let invSr = 1 / sampleRate;
    let nOpen = (decay * sampleRate) | 0;
    if (nOpen < 64) nOpen = 64;
    if (this.openLut.length < nOpen) this.openLut = new Float32Array(nOpen);
    this.openLen = nOpen;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let punchCoeff = Math.exp(-1 / (sampleRate * 0.03));
    let noiseCoeff = Math.exp(-1 / (sampleRate * 0.008));
    let env = 1;
    let punchEnv = 1;
    let noiseEnv = 1;
    let ph = 0;
    for (let i = 0; i < nOpen; i++) {
      let freq = pitch + pitch * 0.18 * punchEnv;
      ph += freq * invSr;
      ph -= ph | 0;
      let body = this.sineAt(ph) * env;
      let skin = this.noise() * noiseEnv * 0.22;
      this.openLut[i] = this.clip((body + skin) * 1.15);
      env *= ampCoeff;
      punchEnv *= punchCoeff;
      noiseEnv *= noiseCoeff;
    }

    let nSlap = (0.07 * sampleRate) | 0;
    if (this.slapLut.length < nSlap) this.slapLut = new Float32Array(nSlap);
    this.slapLen = nSlap;
    let slapAmp = Math.exp(-Math.log(1000) / (0.055 * sampleRate));
    let slapNoise = Math.exp(-1 / (sampleRate * 0.01));
    env = 1;
    noiseEnv = 1;
    ph = 0;
    let slapPitch = pitch * 2.6;
    for (let i = 0; i < nSlap; i++) {
      ph += slapPitch * invSr;
      ph -= ph | 0;
      let click = this.sineAt(ph) * env * 0.35;
      let crack = this.noise() * noiseEnv * 0.85;
      this.slapLut[i] = this.clip(click + crack);
      env *= slapAmp;
      noiseEnv *= slapNoise;
    }

    let nMute = (0.05 * sampleRate) | 0;
    if (this.muteLut.length < nMute) this.muteLut = new Float32Array(nMute);
    this.muteLen = nMute;
    let muteAmp = Math.exp(-Math.log(1000) / (0.04 * sampleRate));
    env = 1;
    ph = 0;
    for (let i = 0; i < nMute; i++) {
      ph += pitch * 0.92 * invSr;
      ph -= ph | 0;
      this.muteLut[i] = this.clip(this.sineAt(ph) * env * 0.7);
      env *= muteAmp;
    }
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let pitch = parameters.pitch[0];
    let decay = parameters.decay[0];
    if (decay < 0.05) decay = 0.05;
    if (pitch !== this.lastPitch || decay !== this.lastDecay) {
      this.lastPitch = pitch;
      this.lastDecay = decay;
      this.bake(pitch, decay);
    }
    let trigs = parameters.trigger;
    let slaps = parameters.slap;
    let mutes = parameters.mute;
    let aT = trigs.length > 1;
    let aS = slaps.length > 1;
    let aM = mutes.length > 1;
    let t0 = trigs[0];
    let s0 = slaps[0];
    let m0 = mutes[0];
    let prevT = this.trigOn;
    let prevS = this.slapOn;
    let prevM = this.muteOn;
    let playO = this.playO;
    let playS = this.playS;
    let playM = this.playM;
    let n = output.length;
    for (let i = 0; i < n; i++) {
      let t = aT ? trigs[i] : t0;
      let s = aS ? slaps[i] : s0;
      let m = aM ? mutes[i] : m0;
      let onT = AppConfig.schmitt(prevT, t);
      let onS = AppConfig.schmitt(prevS, s);
      let onM = AppConfig.schmitt(prevM, m);
      if (onT && !prevT) playO = 0;
      if (onS && !prevS) playS = 0;
      if (onM && !prevM) playM = 0;
      let out = 0;
      if (playO < this.openLen) out += this.openLut[playO++];
      if (playS < this.slapLen) out += this.slapLut[playS++];
      if (playM < this.muteLen) out += this.muteLut[playM++];
      output[i] = this.clip(out);
      prevT = onT;
      prevS = onS;
      prevM = onM;
    }
    this.trigOn = prevT;
    this.slapOn = prevS;
    this.muteOn = prevM;
    this.playO = playO;
    this.playS = playS;
    this.playM = playM;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("hand-drum-worklet", HandDrumWorklet);
