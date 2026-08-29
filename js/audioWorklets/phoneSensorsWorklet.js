class PhoneSensorsWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "phone-sensors");
    this.values = new Float32Array(8);
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) {
      for (let i = 0; i < this.values.length; i++) this.values[i] = sab.getSlot(i);
    }
    let vals = this.values;
    for (let o = 0; o < outputs.length; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (!ch) continue;
      ch.fill(vals[o] || 0);
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("phone-sensors-worklet", PhoneSensorsWorklet);
