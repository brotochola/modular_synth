class TriggerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "trigger");
    this.trigOn = new Float32Array(16);
    this.counts = new Float32Array(16);
  }

  process(inputs) {
    let sab = this.sab;
    for (let p = 0; p < inputs.length; p++) {
      let input = inputs[p];
      if (!input || !input.length) continue;
      let inputChannel = input[0];
      if (!inputChannel || !inputChannel.length) continue;
      let on = this.trigOn[p];
      let fired = false;
      for (let i = 0; i < inputChannel.length; i++) {
        let next = AppConfig.schmitt(on, inputChannel[i]);
        if (!fired && next && !on) fired = true;
        on = next;
      }
      this.trigOn[p] = on;
      if (fired) {
        this.counts[p] += 1;
        if (sab) sab.setSlot(p, this.counts[p]);
      }
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("trigger-worklet", TriggerWorklet);
