class TriggerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.prevValues = [];
  }

  process(inputs) {
    for (let p = 0; p < inputs.length; p++) {
      let input = inputs[p];
      if (!input || !input.length) continue;
      let inputChannel = input[0];
      if (!inputChannel || !inputChannel.length) continue;
      let current = inputChannel[inputChannel.length - 1] || 0;
      let lastVal = this.prevValues[p] || 0;
      if (
        (current > 0 && lastVal <= 0) ||
        (current < 0 && lastVal >= 0) ||
        (current == 0 && lastVal != 0)
      ) {
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

registerProcessor("trigger-worklet", TriggerWorklet);
