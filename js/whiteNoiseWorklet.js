class WhiteNoiseProcessor extends AudioWorkletProcessor {
  // When constructor() undefined, the default constructor will be implicitly
  // used.

  process(inputs, outputs, parameters) {
    let input = inputs[0];
    let output = outputs[0];

    for (let channel = 0; channel < input.length; ++channel) {
      let inputChannel = input[channel];
      let outputChannel = output[channel];
      for (let i = 0; i < inputChannel.length; ++i) {
        outputChannel[i] = inputChannel[i] * 0.5;
      }
    }

    return true;
  }
}

registerProcessor("white-noise-processor", WhiteNoiseProcessor);
