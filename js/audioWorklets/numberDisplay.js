class NumberDisplay extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    try {
      let input1 = (inputs || [])[0] || [];
      for (let channel = 0; channel < input1.length; ++channel) {
        let inputChannel1 = (input1 || [])[channel] || [];
        this.port.postMessage({ number: inputChannel1[127] });
        // for (let i = 0; i < inputChannel1.length; ++i) {
        //   //   counter++;

        //   if (i % 10 == 0) {
        //     let x1 = inputChannel1[i] || 0;
        //     this.port.postMessage({ number: x1 });
        //   }

        //   // this.port.postMessage(inputChannel1[i], inputChannel2[i]);
        //   // this.port.postMessage(outputChannel[i]);

        //   // this.port.postMessage({ data: "hola", output: outputChannel[i] });

        //   // outputChannel[i] = inputChannel[i] * 0.5;
        // }
      }
      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage({ data: "error", e });
    }
    return true;
  }
}

registerProcessor("number-display", NumberDisplay);
