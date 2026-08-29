class customAudioParamsWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "custom-params");
    this.prevValues = new Float32Array(16);
  }

  process(inputs) {
    let sab = this.sab;
    let reset = sab && sab.getNote();
    if (reset && sab) sab.setNote(0);
    for (let p = 0; p < inputs.length; p++) {
      let input = inputs[p];
      if (!input || !input.length) continue;
      let inputChannel = input[0];
      if (!inputChannel || !inputChannel.length) continue;
      let current = inputChannel[inputChannel.length - 1] || 0;
      if (sab) sab.setSlot(p, current);
      this.prevValues[p] = current;
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("custom-params-worklet", customAudioParamsWorklet);
