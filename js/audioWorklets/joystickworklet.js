class JoystickWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.dataFromJoystick = {};
    this.port.onmessage = (e) => {
      // console.log(e.data);
      this.dataFromJoystick = e.data;
      //   this.port.postMessage("UPDATED data from joystick " + this.dataFromJoystick);
    };
  }

  process(inputs, outputs) {
    // this.port.postMessage("FORMULA " + this.formula)
    try {
      for (let out = 0; out < outputs.length; out++) {
        let output = (outputs || [])[out] || [];

        for (let channel = 0; channel < output.length; ++channel) {
          let outputChannel = (output || [])[channel] || [];

          for (let i = 0; i < outputChannel.length; ++i) {
            if (!Array.isArray(this.dataFromJoystick.buttons)) continue;
            if (out >= this.dataFromJoystick.buttons.length) {
              outputChannel[i] =
                this.dataFromJoystick.axes[
                  out - this.dataFromJoystick.buttons.length
                ];
            } else {
              outputChannel[i] = this.dataFromJoystick.buttons[out];
            }
          }
        }
      }
      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("joystick-worklet", JoystickWorklet);
