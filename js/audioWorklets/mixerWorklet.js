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

  process(inputs, outputs, parameters) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const c0 = (inputs[0] && inputs[0][0]) || null;
    const c1 = (inputs[1] && inputs[1][0]) || null;
    const c2 = (inputs[2] && inputs[2][0]) || null;
    const c3 = (inputs[3] && inputs[3][0]) || null;
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
    for (let i = 0; i < n; i++) {
      const x0 = c0 ? c0[i] || 0 : 0;
      const x1 = c1 ? c1[i] || 0 : 0;
      const x2 = c2 ? c2[i] || 0 : 0;
      const x3 = c3 ? c3[i] || 0 : 0;
      out[i] =
        (x0 * (g0k ? g0[0] : g0[i]) +
          x1 * (g1k ? g1[0] : g1[i]) +
          x2 * (g2k ? g2[0] : g2[i]) +
          x3 * (g3k ? g3[0] : g3[i])) *
        (mk ? master[0] : master[i]);
    }
    return true;
  }
}

registerProcessor("mixer-worklet", MixerWorklet);
