class KeyboardWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "keyboard");
    this.status = new Float32Array(16);
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab) {
      let ev;
      while ((ev = sab.pullEvent())) {
        let type = ev & 255;
        if (type !== AppConfig.SAB_EVT_KEY) continue;
        let which = (ev >>> 8) & 255;
        let down = (ev >>> 16) & 255;
        if (which < this.status.length) this.status[which] = down ? 1 : 0;
      }
      for (let i = 0; i < this.status.length; i++) {
        this.status[i] = sab.getSlot(i);
      }
    }
    for (let outputNum = 0; outputNum < outputs.length; outputNum++) {
      let output = outputs[outputNum];
      if (!output) continue;
      let outputChannel = output[0];
      if (!outputChannel) continue;
      outputChannel.fill(this.status[outputNum] ? 1 : 0);
    }
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("keyboard-worklet", KeyboardWorklet);
