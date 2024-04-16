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
    // this.port.postMessage({ parameters: parameters });
    try {
      //try to get the last value of the last input
      let tempWhich = parameters.which[0];
      // this.port.postMessage({ tempWhich});
      if (
        !isNaN(tempWhich) &&
        tempWhich != undefined &&
        tempWhich != 0 &&
        tempWhich < 128
      ) {
        this.which = Math.abs(Math.round(tempWhich));
      } else {
        //if there's no input, use the last saved
        this.which = this.lastWhich;
      }
      if (this.which != this.lastWhich) {
        this.port.postMessage({ which: this.which });
      }

      for (let i = 0; i < outputs[0][0].length; i++) {
        let inputValue = ((inputs[this.which] || [])[0] || [])[i];
        outputs[0][0][i] = inputValue || 0;
      }
      this.lastWhich = tempWhich;
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("multiplexor-worklet", MultiplexorWorklet);
