class NumberDisplay extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "number-display");
    this.lastPosted = NaN;
  }

  process(inputs) {
    let input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    let number = input[input.length - 1];
    if (number !== number) number = 0;
    let sab = this.sab;
    // NaN >= x is false, so first sample never published with `abs >= thr`
    if (sab && !(Math.abs(number - this.lastPosted) < 0.0005)) {
      this.lastPosted = number;
      sab.setSlot(0, number);
      sab.publish();
    }
    if (sab) AppConfig.sabWriteGraphPeaks(sab, inputs, null);
    return true;
  }
}

registerProcessor("number-display", NumberDisplay);
