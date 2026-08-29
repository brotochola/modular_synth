class JackActivityWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "jack-activity");
    this.counter = 0;
  }

  process(inputs) {
    let sab = this.sab;
    let n = inputs.length;
    if (n > 32) n = 32;
    for (let p = 0; p < n; p++) {
      let peak = AppConfig.peakAbs(inputs[p] && inputs[p][0]);
      if (sab) sab.setSlot(p, peak);
    }
    this.counter++;
    if (this.counter >= AppConfig.JACK_ACTIVITY_REPORT_EVERY) {
      this.counter = 0;
      if (sab) sab.publish();
    }
    return true;
  }
}

registerProcessor("jack-activity-worklet", JackActivityWorklet);
