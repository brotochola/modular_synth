class JoystickWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "joystick");
    this.dataFromJoystick = {};
    this.port.onmessage = (e) => {
      this.dataFromJoystick = e.data;
    };
  }

  process(inputs, outputs) {
    let buttons = this.dataFromJoystick.buttons;
    let axes = this.dataFromJoystick.axes;
    if (!buttons) return true;
    let nButtons = buttons.length;
    for (let out = 0; out < outputs.length; out++) {
      let channel = outputs[out] && outputs[out][0];
      if (!channel) continue;
      let val;
      if (out >= nButtons) {
        val = axes[out - nButtons] || 0;
      } else {
        val = buttons[out] ? 1 : 0;
      }
      for (let i = 0; i < channel.length; ++i) {
        channel[i] = val;
      }
    }
    return true;
  }
}

registerProcessor("joystick-worklet", JoystickWorklet);
