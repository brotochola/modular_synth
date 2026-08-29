class LerpProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "time",
        defaultValue: 0.5,
        minValue: 0.0001,
        maxValue: 10,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "lerp");
    this.lastValue = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let last = this.lastValue;
    let t = parameters.time[0];
    if (t == 0 || isNaN(t)) t = 0.5;
    else if (t < 0.0001) t = 0.0001;
    let coeff = 0.0001 / t;
    if (input) {
      for (let i = 0; i < n; i++) {
        last = last + (input[i] - last) * coeff;
        output[i] = last;
      }
    } else {
      output.fill(last);
    }
    this.lastValue = last;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("lerp-processor", LerpProcessor);
