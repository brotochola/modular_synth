class KeyboardWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.status = [];
    this.port.onmessage = (e) => {
      if (e.data.type == "down") {
        this.status[e.data.which] = true;
      } else if (e.data.type == "up") {
        this.status[e.data.which] = false;
      }
      // this.port.postMessage({ status: this.status });
    };
  }

  process(inputs, outputs) {
    try {
      for (let outputNum = 0; outputNum < outputs.length; outputNum++) {
        let output = outputs[outputNum];

        for (let channel = 0; channel < output.length; ++channel) {
          let outputChannel = (output || [])[channel] || [];
          for (let i = 0; i < outputChannel.length; ++i) {
            outputChannel[i] = this.status[outputNum] ? 1 : 0;
          }
        }
      }
      // this.port.postMessage( this.status);
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("keyboard-worklet", KeyboardWorklet);
