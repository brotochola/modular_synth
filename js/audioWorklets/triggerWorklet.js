class TriggerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "trigger");
    this.prevValues = new Float32Array(16);
    this.counts = new Float32Array(16);
  }

  process(inputs) {
    let sab = this.sab;
    for (let p = 0; p < inputs.length; p++) {
      let input = inputs[p];
      if (!input || !input.length) continue;
      let inputChannel = input[0];
      if (!inputChannel || !inputChannel.length) continue;
      let lastVal = this.prevValues[p];
      let fired = false;
      let prev = lastVal;
      for (let i = 0; i < inputChannel.length; i++) {
        let current = inputChannel[i];
        if (
          !fired &&
          ((current > 0 && prev <= 0) ||
            (current < 0 && prev >= 0) ||
            (current == 0 && prev != 0))
        ) {
          fired = true;
        }
        prev = current;
      }
      if (fired) {
        this.counts[p] += 1;
        if (sab) sab.setSlot(p, this.counts[p]);
      }
      this.prevValues[p] = prev;
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("trigger-worklet", TriggerWorklet);
