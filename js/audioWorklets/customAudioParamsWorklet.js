class customAudioParamsWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "custom-params");
    this.prevValues = [];
    this.reset = false;
    this.port.onmessage = (e) => {
      if (e.data.reset) {
        this.reset = true;
      }
    };
  }

  process(inputs) {
    for (let p = 0; p < inputs.length; p++) {
      let input = inputs[p];
      if (!input || !input.length) continue;
      let inputChannel = input[0];
      if (!inputChannel || !inputChannel.length) continue;
      let current = inputChannel[inputChannel.length - 1] || 0;
      let lastVal = this.prevValues[p] || 0;
      if (current != lastVal || this.reset) {
        this.reset = false;
        this.port.postMessage({
          channelTriggered: p,
          lastVal,
          current,
        });
      }
      this.prevValues[p] = current;
    }
    return true;
  }
}

registerProcessor("custom-params-worklet", customAudioParamsWorklet);
