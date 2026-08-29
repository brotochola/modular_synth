class PeakDetectorWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "peak-detector");
    this.outputVal = 0;
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (sab && sab.getNote()) {
      this.outputVal = 0;
      sab.setNote(0);
    }
    let outputChannel = outputs[0] && outputs[0][0];
    let inputChannel = inputs[0] && inputs[0][0];
    if (!outputChannel) return true;
    let n = outputChannel.length;
    let maxVal = this.outputVal;
    if (inputChannel) {
      for (let i = 0; i < n; ++i) {
        let inputVal = inputChannel[i];
        if (inputVal < 0) inputVal = -inputVal;
        if (inputVal > maxVal) maxVal = inputVal;
        outputChannel[i] = maxVal;
      }
    } else {
      outputChannel.fill(maxVal);
    }
    this.outputVal = maxVal;
    if (sab) {
      AppConfig.sabWriteGraphPeaks(sab, inputs, null);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("peak-detector-worklet", PeakDetectorWorklet);
