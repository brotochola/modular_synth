class DemultiplexorWorklet extends AudioWorkletProcessor {
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
    if (globalThis.AudioProfile) AudioProfile.attach(this, "demultiplexor");
    this.which = 0;
    this.lastWhich = -1;
  }

  process(inputs, outputs, parameters) {
    let raw = parameters.which[0];
    let which = Math.abs(Math.round(raw));
    if (isNaN(which) || which < 0) which = 0;
    if (which > 7) which = 7;
    this.which = which;

    if (this.which != this.lastWhich) {
      this.port.postMessage({ which: this.which });
      this.lastWhich = this.which;
    }

    let signal = inputs[0] && inputs[0][0];
    let n = 128;
    for (let o = 0; o < outputs.length; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (ch && ch.length > n) n = ch.length;
    }

    for (let o = 0; o < 8; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (!ch) continue;
      let len = ch.length;
      if (o === which) {
        if (signal) {
          for (let i = 0; i < len; i++) ch[i] = signal[i] || 0;
        } else {
          for (let i = 0; i < len; i++) ch[i] = 0;
        }
      } else {
        for (let i = 0; i < len; i++) ch[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor("demultiplexor-worklet", DemultiplexorWorklet);
