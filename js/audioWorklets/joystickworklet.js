class JoystickWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "joystick");
  }

  process(inputs, outputs) {
    let sab = this.sab;
    if (!sab) return true;
    for (let out = 0; out < outputs.length; out++) {
      let channel = outputs[out] && outputs[out][0];
      if (!channel) continue;
      channel.fill(sab.getSlot(out));
    }
    AppConfig.sabWriteGraphPeaks(sab, inputs, null);
    sab.publish();
    return true;
  }
}

registerProcessor("joystick-worklet", JoystickWorklet);
