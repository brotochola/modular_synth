class DistortionWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.amount=0
    this.port.onmessage = (e) => {
      if (e.data.distortion) {
        this.amount = e.data.distortion;
      }
    };
  }

  process(inputs, outputs) {
    try {
      let output = outputs[0];
      let input1 = inputs[0];

      let outputChannel = (output || [])[0] || [];
      let inputChannel1 = (input1 || [])[0] || [];

      for (let i = 0; i < outputChannel.length; ++i) {
        outputChannel[i] =
          (1 / (1 + Math.E ** (this.amount * inputChannel1[i])) - 0.5) * 2;
      }
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("distortion-worklet", DistortionWorklet);
