class CounterWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "counter");
    this.val = 0;
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) this.val = sab.getSlot(0);
    let outputChannel = outputs[0] && outputs[0][0];
    if (!outputChannel) return true;
    outputChannel.fill(this.val);
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("counter-worklet", CounterWorklet);
