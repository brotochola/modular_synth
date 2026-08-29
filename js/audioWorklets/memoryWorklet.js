class MemoryWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "memory");
    this.val = 0;
  }

  process(inputs, outputs) {
    let outputChannel = outputs[0] && outputs[0][0];
    let inputChannel = inputs[0] && inputs[0][0];
    if (!outputChannel) return true;
    let n = outputChannel.length;
    let val = this.val;
    if (inputChannel) {
      for (let i = 0; i < n; ++i) {
        let x = inputChannel[i];
        if (x !== 0) val = x;
        outputChannel[i] = val;
      }
    } else {
      outputChannel.fill(val);
    }
    this.val = val;
    if (this.sab) {
      this.sab.setSlot(0, val);
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("memory-worklet", MemoryWorklet);
