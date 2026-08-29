class WhiteNoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "white-noise");
    this.noise = 1;
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0];
    if (!output) return true;
    let noise = this.noise;
    for (let channel = 0; channel < output.length; ++channel) {
      let outputChannel = output[channel];
      if (!outputChannel) continue;
      for (let i = 0; i < outputChannel.length; ++i) {
        noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
        outputChannel[i] = noise / 2147483648;
      }
    }
    this.noise = noise;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("white-noise-processor", WhiteNoiseProcessor);
