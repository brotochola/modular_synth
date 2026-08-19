class MultiplexorWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "which",
        defaultValue: 0,
      },
    ];
  }
  constructor() {
    super();
    this.which = 0;
    this.lastWhich = 0;
  }

  process(inputs, outputs, parameters) {
    let tempWhich = parameters.which[0];
    if (!isNaN(tempWhich) && tempWhich != undefined && tempWhich != 0 && tempWhich < 128) {
      this.which = Math.abs(Math.round(tempWhich));
    } else {
      this.which = this.lastWhich;
    }
    if (this.which != this.lastWhich) {
      this.port.postMessage({ which: this.which });
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
    this.lastWhich = this.which;
    return true;
  }
}

registerProcessor("multiplexor-worklet", MultiplexorWorklet);
