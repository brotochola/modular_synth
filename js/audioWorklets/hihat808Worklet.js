class HiHat808Worklet extends AudioWorkletProcessor {
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
        name: "open",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
      {
        name: "decay",
        defaultValue: 0.35,
        minValue: 0.05,
        maxValue: 2,
        automationRate: "k-rate",
      },
      {
        name: "tone",
        defaultValue: 7000,
        minValue: 2000,
        maxValue: 12000,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "hihat808");
    this.trigOn = 0;
    this.openOn = 0;
    this.playCh = 1e9;
    this.playOh = 1e9;
    this.chLut = new Float32Array(0);
    this.ohLut = new Float32Array(0);
    this.chLen = 0;
    this.ohLen = 0;
    this.lastTone = NaN;
    this.lastDecay = NaN;
  }

  bakeMetal(dest, n, tone, decay) {
    let freqs = AppConfig.HAT_FREQS;
    let invSr = 1 / sampleRate;
    let ampCoeff = Math.exp(-Math.log(1000) / (decay * sampleRate));
    let hpK = 1 - Math.exp((-2 * Math.PI * tone) / sampleRate);
    let ph = [0, 0, 0, 0, 0, 0];
    let lp = 0;
    let env = 1;
    let nOsc = freqs.length;
    for (let i = 0; i < n; i++) {
      let mix = 0;
      for (let o = 0; o < nOsc; o++) {
        ph[o] += freqs[o] * invSr;
        ph[o] -= ph[o] | 0;
        mix += ph[o] < 0.5 ? 1 : -1;
      }
      mix /= nOsc;
      lp += hpK * (mix - lp);
      let out = (mix - lp) * env * 1.4;
      if (out > 1) out = 1;
      else if (out < -1) out = -1;
      else out = out / (1 + (out < 0 ? -out : out));
      dest[i] = out;
      env *= ampCoeff;
    }
  }

  bakeClosed(tone) {
    let decay = AppConfig.HAT_CLOSED_SEC;
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.chLut.length < n) this.chLut = new Float32Array(n);
    this.chLen = n;
    this.bakeMetal(this.chLut, n, tone, decay);
  }

  bakeOpen(tone, decay) {
    let n = (decay * sampleRate) | 0;
    if (n < 64) n = 64;
    if (this.ohLut.length < n) this.ohLut = new Float32Array(n);
    this.ohLen = n;
    this.bakeMetal(this.ohLut, n, tone, decay);
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let tone = parameters.tone[0];
    let decay = parameters.decay[0];
    if (decay < 0.05) decay = 0.05;
    if (tone !== this.lastTone) {
      this.lastTone = tone;
      this.lastDecay = decay;
      this.bakeClosed(tone);
      this.bakeOpen(tone, decay);
    } else if (decay !== this.lastDecay) {
      this.lastDecay = decay;
      this.bakeOpen(tone, decay);
    }
    let trigs = parameters.trigger;
    let opens = parameters.open;
    let aTrig = trigs.length > 1;
    let aOpen = opens.length > 1;
    let trig0 = trigs[0];
    let open0 = opens[0];
    let prev = this.trigOn;
    let prevO = this.openOn;
    let playCh = this.playCh;
    let playOh = this.playOh;
    let chLut = this.chLut;
    let ohLut = this.ohLut;
    let chLen = this.chLen;
    let ohLen = this.ohLen;
    let n = output.length;
    for (let i = 0; i < n; i++) {
      let trig = aTrig ? trigs[i] : trig0;
      let opn = aOpen ? opens[i] : open0;
      let on = AppConfig.schmitt(prev, trig);
      let onO = AppConfig.schmitt(prevO, opn);
      if (on && !prev) {
        playCh = 0;
        playOh = ohLen;
      }
      if (onO && !prevO) playOh = 0;
      let out = 0;
      if (playCh < chLen) out += chLut[playCh++];
      if (playOh < ohLen) out += ohLut[playOh++];
      output[i] = out;
      prev = on;
      prevO = onO;
    }
    this.trigOn = prev;
    this.openOn = prevO;
    this.playCh = playCh;
    this.playOh = playOh;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("hihat808-worklet", HiHat808Worklet);
