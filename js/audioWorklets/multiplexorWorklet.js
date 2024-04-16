class MultiplexorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.which = 0;
    this.lastWhich = 0;
  }

  process(inputs, outputs) {
    // this.port.postMessage({ inputs, outputs });
    try {
      //try to get the last value of the last input
      let tempWhich = Math.abs(Math.round(((inputs[0] || [])[0] || [])[127]));
      if (tempWhich) {
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
