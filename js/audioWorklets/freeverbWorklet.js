class FreeverbWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "size",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "damp",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "wet",
        defaultValue: 0.35,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "width",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "freeverb");
    let scale = sampleRate / 44100;
    let combT = AppConfig.FREEVERB_COMB;
    let apT = AppConfig.FREEVERB_ALLPASS;
    let spread = Math.round(AppConfig.FREEVERB_SPREAD * scale);
    if (spread < 1) spread = 1;
    this.combsL = [];
    this.combsR = [];
    for (let i = 0; i < combT.length; i++) {
      let nL = Math.round(combT[i] * scale);
      if (nL < 2) nL = 2;
      let nR = nL + spread;
      this.combsL.push({ buf: new Float32Array(nL), idx: 0, filter: 0, len: nL });
      this.combsR.push({ buf: new Float32Array(nR), idx: 0, filter: 0, len: nR });
    }
    this.apsL = [];
    this.apsR = [];
    for (let i = 0; i < apT.length; i++) {
      let nL = Math.round(apT[i] * scale);
      if (nL < 2) nL = 2;
      let nR = nL + spread;
      this.apsL.push({ buf: new Float32Array(nL), idx: 0, len: nL });
      this.apsR.push({ buf: new Float32Array(nR), idx: 0, len: nR });
    }
    // ponytail: delay scale self-check. Upgrade = interpolate fractional delays.
    if (Math.abs(this.combsL[0].len - Math.round(combT[0] * scale)) > 0) {
      console.error("freeverb delay scale self-check fail");
    }
  }

  comb(c, input, feedback, damp) {
    let bufout = c.buf[c.idx];
    c.filter = bufout * (1 - damp) + c.filter * damp;
    c.buf[c.idx] = input + c.filter * feedback;
    if (++c.idx >= c.len) c.idx = 0;
    return bufout;
  }

  allpass(a, input) {
    let bufout = a.buf[a.idx];
    let out = -input + bufout;
    a.buf[a.idx] = input + bufout * 0.5;
    if (++a.idx >= a.len) a.idx = 0;
    return out;
  }

  tank(combs, aps, input, feedback, damp) {
    let acc = 0;
    for (let i = 0; i < combs.length; i++) {
      acc += this.comb(combs[i], input, feedback, damp);
    }
    for (let i = 0; i < aps.length; i++) {
      acc = this.allpass(aps[i], acc);
    }
    return acc;
  }

  process(inputs, outputs, parameters) {
    let outL = outputs[0] && outputs[0][0];
    let outR = outputs[1] && outputs[1][0];
    if (!outL) return true;
    let inp = inputs[0] && inputs[0][0];
    let n = outL.length;
    let size = parameters.size[0];
    if (size < 0) size = 0;
    if (size > 1) size = 1;
    let dampIn = parameters.damp[0];
    if (dampIn < 0) dampIn = 0;
    if (dampIn > 1) dampIn = 1;
    let wet = parameters.wet[0];
    if (wet < 0) wet = 0;
    if (wet > 1) wet = 1;
    let width = parameters.width[0];
    if (width < 0) width = 0;
    if (width > 1) width = 1;
    let feedback = 0.7 + size * 0.28;
    let damp = dampIn * 0.4;
    let dry = 1 - wet;
    let wet1 = wet * (width * 0.5 + 0.5);
    let wet2 = wet * ((1 - width) * 0.5);
    let gain = 0.015;
    for (let i = 0; i < n; i++) {
      let x = inp ? inp[i] * gain : 0;
      let accL = this.tank(this.combsL, this.apsL, x, feedback, damp);
      let accR = this.tank(this.combsR, this.apsR, x, feedback, damp);
      let dryX = inp ? inp[i] * dry : 0;
      outL[i] = dryX + wet1 * accL + wet2 * accR;
      if (outR) outR[i] = dryX + wet1 * accR + wet2 * accL;
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("freeverb-worklet", FreeverbWorklet);
