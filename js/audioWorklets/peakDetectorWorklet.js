class PeakDetectorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.outputVal = 0;
    this.port.onmessage = (e) => {
      if (e.data == "reset") {        
        this.outputVal = 0;
      }
    };
  }

  process(inputs, outputs) {
    try {
      for (let outputNum = 0; outputNum < outputs.length; outputNum++) {
        let output = outputs[outputNum];
        let input = inputs[outputNum];

        for (let channel = 0; channel < output.length; ++channel) {
          let outputChannel = (output || [])[channel] || [];
          let inputChannel = (input || [])[channel] || [];
          for (let i = 0; i < outputChannel.length; ++i) {
            let inputVal = Math.abs((inputChannel || [])[i] || 0);
            let maxVal = Math.abs(this.outputVal);
            // console.log(inputVal, maxVal)
            
            if (inputVal > maxVal) {
              this.outputVal = inputVal;
              //   this.port.postMessage(maxVal);
            }
            // console.log(maxVal);
            
            outputChannel[i] = this.outputVal;
          }
        }
      }

      //   this.port.postMessage(output);
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("peak-detector-worklet", PeakDetectorWorklet);
