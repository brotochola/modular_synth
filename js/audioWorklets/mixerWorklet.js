class MixerWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    let d = [];
    for (let i = 0; i < 8; i++) {
      d.push({ name: "g" + i, defaultValue: 1, minValue: 0, maxValue: 2 });
    }
    d.push({ name: "master", defaultValue: 1, minValue: 0, maxValue: 2 });
    return d;
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "mixer");
    this.lastPostTime = 0;
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const master = parameters.master;
    const mk = master.length === 1;
    const vm = mk ? master[0] : 0;
    const n = out.length;
    const chans = new Array(8);
    const gains = new Array(8);
    const gk = new Array(8);
    const gv = new Array(8);
    for (let c = 0; c < 8; c++) {
      chans[c] = inputs[c] && inputs[c][0];
      let g = parameters["g" + c];
      gains[c] = g;
      gk[c] = g.length === 1;
      gv[c] = gk[c] ? g[0] : 0;
    }
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let c = 0; c < 8; c++) {
        let x = chans[c] ? chans[c][i] : 0;
        sum += x * (gk[c] ? gv[c] : gains[c][i]);
      }
      out[i] = sum * (mk ? vm : master[i]);
    }

    if (this.sab && currentTime - this.lastPostTime >= 1 / 20) {
      this.lastPostTime = currentTime;
      for (let c = 0; c < 8; c++) {
        let g = gains[c];
        this.sab.setSlot(c, g[g.length - 1]);
      }
      this.sab.setSlot(8, master[master.length - 1]);
      this.sab.publish();
    }
    if (this.sab) AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
    return true;
  }
}

registerProcessor("mixer-worklet", MixerWorklet);
