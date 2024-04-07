
class FixedValueAudioWorklet extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {   
    const output = outputs[0];
    output.forEach((channel) => {
      for (let i = 0; i < channel.length; i++) {
        channel[i] = 1;
      }
    });
    return true;
  }
}

registerProcessor("fixed-value-worklet", FixedValueAudioWorklet);