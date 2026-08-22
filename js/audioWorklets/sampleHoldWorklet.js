class SampleHoldWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.held = 0;
    this.prevClock = 0;
  }

  process(inputs, outputs) {
    let signal = inputs[0] && inputs[0][0];
    let clock = inputs[1] && inputs[1][0];
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let hasSignal = !!(signal && signal.length);
    let hasClock = !!(clock && clock.length);
    let prev = this.prevClock;
    let held = this.held;
    for (let i = 0; i < n; i++) {
      let ck = hasClock ? clock[i] : 0;
      if (prev < 0.5 && ck >= 0.5) {
        held = hasSignal ? signal[i] : Math.random() * 2 - 1;
      }
      output[i] = held;
      prev = ck;
    }
    this.prevClock = prev;
    this.held = held;
    return true;
  }
}

registerProcessor("sample-hold-worklet", SampleHoldWorklet);
