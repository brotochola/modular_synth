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
      if (!isNaN(tempWhich) && tempWhich != undefined) {
        this.lastWhich = tempWhich;
        this.which = tempWhich;
      } else {
        //if there's no input, use the last saved
        this.which = this.lastWhich;
      }

      for (let i = 0; i < outputs[0][0].length; i++) {
        let inputValue = ((inputs[this.which] || [])[0] || [])[i];
        outputs[0][0][i] = inputValue || 0;
      }
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("multiplexor-worklet", MultiplexorWorklet);
