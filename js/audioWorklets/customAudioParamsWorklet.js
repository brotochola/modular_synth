class customAudioParamsWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.prevValues = {};
    // this.port.postMessage({ who: "customAudioParamsWorklet " });
  }

  process(inputs) {
    // this.port.postMessage({ hola: 11 });
    try {
      for (let p = 0; p < inputs.length; p++) {
        let input = inputs[p];
        for (let channel = 0; channel < input.length; ++channel) {
          let inputChannel = (input || [])[channel] || [];

          let current = inputChannel[127] || 0;
          let lastVal = this.prevValues[channel + "_" + p] || 0;

          // if (current !=lastVal) {
          this.port.postMessage({
            channelTriggered: p,
            lastVal,
            current,
            prevValues: this.prevValues,
            // inputs,
          });
          // }
          this.prevValues[channel + "_" + p] = current;
        }
      }
    } catch (e) {
      this.port.postMessage({ data: "error", e });
    }
    return true;
  }
}

registerProcessor("custom-params-worklet", customAudioParamsWorklet);
