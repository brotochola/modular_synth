class KeyboardWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "keyboard");
    this.status = [];
    this.port.onmessage = (e) => {
      if (e.data.type == "down") {
        this.status[e.data.which] = true;
      } else if (e.data.type == "up") {
        this.status[e.data.which] = false;
      }
    };
  }

  process(inputs, outputs) {
    for (let outputNum = 0; outputNum < outputs.length; outputNum++) {
      let output = outputs[outputNum];
      if (!output) continue;
      let outputChannel = output[0];
      if (!outputChannel) continue;
      let val = this.status[outputNum] ? 1 : 0;
      for (let i = 0; i < outputChannel.length; ++i) {
        outputChannel[i] = val;
      }
    }
    return true;
  }
}

registerProcessor("keyboard-worklet", KeyboardWorklet);
