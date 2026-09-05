class WavefolderWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 8,
        automationRate: "a-rate",
      },
      {
        name: "offset",
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "mix",
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
    if (globalThis.AudioProfile) AudioProfile.attach(this, "wavefolder");
  }

  process(inputs, outputs, parameters) {
    let out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let inp = inputs[0] && inputs[0][0];
    let n = out.length;
    if (!inp) {
      out.fill(0);
      if (this.sab) {
        AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
        this.sab.publish();
      }
      return true;
    }
    let gains = parameters.gain;
    let aGain = gains.length > 1;
    let gain0 = gains[0];
    let offset = parameters.offset[0] * Math.PI;
    let mix = parameters.mix[0];
    if (mix < 0) mix = 0;
    if (mix > 1) mix = 1;
    let dryMix = 1 - mix;
    for (let i = 0; i < n; i++) {
      let g = aGain ? gains[i] : gain0;
      if (g < 0) g = 0;
      let x = inp[i];
      let folded = Math.sin(x * g * Math.PI + offset);
      out[i] = dryMix * x + mix * folded;
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("wavefolder-worklet", WavefolderWorklet);
