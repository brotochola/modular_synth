class CounterWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.val = 0;
    this.port.onmessage = (e) => {
      this.port.postMessage({ val: e.data.val });
      this.val = e.data.val;
    };
  }

  process(inputs, outputs) {
    // this.port.postMessage({ savedValue: this.val });

    try {
      let output = outputs[0];
      let input = inputs[0];

      for (let channel = 0; channel < output.length; ++channel) {
        let outputChannel = (output || [])[channel] || [];
        let inputChannel = (input || [])[channel] || [];

        for (let i = 0; i < outputChannel.length; ++i) {
          outputChannel[i] = this.val;
        }
      }

      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("counter-worklet", CounterWorklet);
