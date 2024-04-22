class MemoryWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.val = 0;
    this.port.onmessage = (e) => {
      //   this.port.postMessage("UPDATED data from joystick " + this.dataFromJoystick);
    };

  }


  process(inputs, outputs) {
    this.port.postMessage({savedValue:this.val})

    try {
      let output = outputs[0];
      let input = inputs[0];

      for (let channel = 0; channel < output.length; ++channel) {
        let outputChannel = (output || [])[channel] || [];
        let inputChannel = (input || [])[channel] || [];

        for (let i = 0; i < outputChannel.length; ++i) {
            
          this.val = inputChannel[i] != 0 ? inputChannel[i] : this.val;
          if (isNaN(this.val)) this.val = 0;
          outputChannel[i] = this.val;
        }
      }

      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("memory-worklet", MemoryWorklet);
