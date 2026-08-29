class MixerWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "g0", defaultValue: 1, minValue: 0, maxValue: 2 },
      { name: "g1", defaultValue: 1, minValue: 0, maxValue: 2 },
      { name: "g2", defaultValue: 1, minValue: 0, maxValue: 2 },
      { name: "g3", defaultValue: 1, minValue: 0, maxValue: 2 },
      { name: "master", defaultValue: 1, minValue: 0, maxValue: 2 },
    ];
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
    const c0 = inputs[0] && inputs[0][0];
    const c1 = inputs[1] && inputs[1][0];
    const c2 = inputs[2] && inputs[2][0];
    const c3 = inputs[3] && inputs[3][0];
    const g0 = parameters.g0;
    const g1 = parameters.g1;
    const g2 = parameters.g2;
    const g3 = parameters.g3;
    const master = parameters.master;
    const g0k = g0.length === 1;
    const g1k = g1.length === 1;
    const g2k = g2.length === 1;
    const g3k = g3.length === 1;
    const mk = master.length === 1;
    const n = out.length;
    const v0 = g0k ? g0[0] : 0;
    const v1 = g1k ? g1[0] : 0;
    const v2 = g2k ? g2[0] : 0;
    const v3 = g3k ? g3[0] : 0;
    const vm = mk ? master[0] : 0;
    if (c0 && c1 && c2 && c3 && g0k && g1k && g2k && g3k && mk) {
      for (let i = 0; i < n; i++) {
        out[i] = (c0[i] * v0 + c1[i] * v1 + c2[i] * v2 + c3[i] * v3) * vm;
      }
    } else {
      for (let i = 0; i < n; i++) {
        let x0 = c0 ? c0[i] : 0;
        let x1 = c1 ? c1[i] : 0;
        let x2 = c2 ? c2[i] : 0;
        let x3 = c3 ? c3[i] : 0;
        out[i] =
          (x0 * (g0k ? v0 : g0[i]) +
            x1 * (g1k ? v1 : g1[i]) +
            x2 * (g2k ? v2 : g2[i]) +
            x3 * (g3k ? v3 : g3[i])) *
          (mk ? vm : master[i]);
      }
    }

    if (this.sab && currentTime - this.lastPostTime >= 1 / 20) {
      this.lastPostTime = currentTime;
      this.sab.setSlot(0, g0[g0.length - 1]);
      this.sab.setSlot(1, g1[g1.length - 1]);
      this.sab.setSlot(2, g2[g2.length - 1]);
      this.sab.setSlot(3, g3[g3.length - 1]);
      this.sab.setSlot(4, master[master.length - 1]);
      this.sab.publish();
    }
    if (this.sab) AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
    return true;
  }
}

registerProcessor("mixer-worklet", MixerWorklet);
