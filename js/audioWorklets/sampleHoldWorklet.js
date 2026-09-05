class SampleHoldWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sample-hold");
    this.held = 0;
    this.clockOn = 0;
    this.noise = 1;
  }

  process(inputs, outputs) {
    let signal = inputs[0] && inputs[0][0];
    let clock = inputs[1] && inputs[1][0];
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let hasSignal = !!(signal && signal.length);
    let hasClock = !!(clock && clock.length);
    let prev = this.clockOn;
    let held = this.held;
    let noise = this.noise;
    for (let i = 0; i < n; i++) {
      let ck = hasClock ? clock[i] : 0;
      let on = AppConfig.schmitt(prev, ck);
      if (on && !prev) {
        if (hasSignal) held = signal[i];
        else {
          noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
          held = noise / 2147483648;
        }
      }
      output[i] = held;
      prev = on;
    }
    this.clockOn = prev;
    this.held = held;
    this.noise = noise;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("sample-hold-worklet", SampleHoldWorklet);
