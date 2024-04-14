class TriggerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    try {
      for (let p = 0; p < inputs.length; p++) {
        let input = inputs[p];
        for (let channel = 0; channel < input.length; ++channel) {
          let inputChannel = (input || [])[channel] || [];

          for (let i = 0; i < inputChannel.length; i++) {
            let lastVal;
            if (i == inputChannel.length - 1) {
              this.lastValueFromPrevBuffer = inputChannel[i];
              lastVal = inputChannel[i - 1];
            } else if (i == 0) {
              lastVal = this.lastValueFromPrevBuffer;
            } else {
              lastVal = inputChannel[i - 1];
            }
            if (
              (inputChannel[i] > 0 && lastVal <= 0) ||
              (inputChannel[i] < 0 && lastVal >= 0)
            ) {
              this.port.postMessage({ channelTriggered: p });
            }
          }
        }
      }
    } catch (e) {
      this.port.postMessage({ data: "error", e });
    }
    return true;
  }
}

registerProcessor("trigger-worklet", TriggerWorklet);
