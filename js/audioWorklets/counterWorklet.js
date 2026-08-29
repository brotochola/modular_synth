class CounterWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "counter");
    this.val = 0;
    this.port.onmessage = (e) => {
      this.val = e.data.val;
    };
  }

  process(inputs, outputs) {
    let output = outputs[0];
    if (!output) return true;
    let outputChannel = output[0];
    if (!outputChannel) return true;
    let val = this.val;
    for (let i = 0; i < outputChannel.length; ++i) {
      outputChannel[i] = val;
    }
    return true;
  }
}

registerProcessor("counter-worklet", CounterWorklet);
