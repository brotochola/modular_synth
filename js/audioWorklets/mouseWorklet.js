class MouseWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "mouse");
    this.x = 0;
    this.y = 0;
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) {
      this.x = sab.getSlot(0);
      this.y = sab.getSlot(1);
    }
    let chX = outputs[0] && outputs[0][0];
    let chY = outputs[1] && outputs[1][0];
    if (chX) chX.fill(this.x);
    if (chY) chY.fill(this.y);
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("mouse-worklet", MouseWorklet);
