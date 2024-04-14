class WhiteNoiseProcessor extends AudioWorkletProcessor {
  // When constructor() undefined, the default constructor will be implicitly
  // used.

  process(inputs, outputs, parameters) {
    let output = outputs[0];
    try {
      for (let channel = 0; channel < output.length; ++channel) {
        // let inputChannel = input[channel];
        let outputChannel = output[channel];
        for (let i = 0; i < outputChannel.length; ++i) {
          outputChannel[i] = Math.random()*2-1;
        }
      }
    } catch (e) {
      this.port.postMessage(e);
    }

    return true;
  }
}

registerProcessor("white-noise-processor", WhiteNoiseProcessor);
