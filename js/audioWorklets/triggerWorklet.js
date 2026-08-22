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
      let lastVal = this.prevValues[p] || 0;
      let fired = false;
      let fireLast = lastVal;
      let fireCurrent = lastVal;
      let prev = lastVal;
      for (let i = 0; i < inputChannel.length; i++) {
        let current = inputChannel[i] || 0;
        if (
          !fired &&
          ((current > 0 && prev <= 0) ||
            (current < 0 && prev >= 0) ||
            (current == 0 && prev != 0))
        ) {
          fired = true;
          fireLast = prev;
          fireCurrent = current;
        }
        prev = current;
      }
      if (fired) {
        this.port.postMessage({
          channelTriggered: p,
          lastVal: fireLast,
          current: fireCurrent,
        });
      }
      this.prevValues[p] = prev;
    }
    return true;
  }
}

registerProcessor("trigger-worklet", TriggerWorklet);
