class MultiplexorWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "which",
        defaultValue: 0,
        minValue: 0,
        maxValue: 7,
      },
    ];
  }
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "multiplexor");
    this.which = 0;
    this.lastWhich = -1;
  }

  process(inputs, outputs, parameters) {
    let which = Math.abs(Math.round(parameters.which[0]));
    if (isNaN(which) || which < 0) which = 0;
    if (which > 7) which = 7;
    this.which = which;

    if (this.which != this.lastWhich) {
      this.port.postMessage({ which: this.which });
      this.lastWhich = this.which;
    }

    let out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let inputCh = (inputs[this.which] && inputs[this.which][0]) || null;
    let n = out.length;
    if (inputCh) {
      for (let i = 0; i < n; i++) {
        out[i] = inputCh[i] || 0;
      }
    } else {
      for (let i = 0; i < n; i++) {
        out[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor("multiplexor-worklet", MultiplexorWorklet);
