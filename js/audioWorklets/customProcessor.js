class CustomProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      console.log(e.data);
      this.formula = e.data;
      // this.port.postMessage("UPDATED FORMULA " + this.formula);
    };
  }
  getFormula() {
    return this.formula;
  }

  process(inputs, outputs) {
    // this.port.postMessage("FORMULA " + this.formula)
    try {
      let input1 = (inputs || [])[0] || [];
      let input2 = (inputs || [])[1] || [];
      let input3 = (inputs || [])[2] || [];
      let output = (outputs || [])[0] || [];
      // this.port.postMessage(inputs);
      let counter = 0;

      for (let channel = 0; channel < output.length; ++channel) {
        let inputChannel1 = (input1 || [])[channel] || [];
        let inputChannel2 = (input2 || [])[channel] || [];
        let inputChannel3 = (input3 || [])[channel] || [];
        let outputChannel = (output || [])[channel] || [];

        for (let i = 0; i < outputChannel.length; ++i) {
          counter++;
          let x1 = inputChannel1[i] || 0;
          let x2 = inputChannel2[i] || 0;
          let x3 = inputChannel3[i] || 0;

        

          // this.port.postMessage(inputChannel1[i], inputChannel2[i]);
          // this.port.postMessage(outputChannel[i]);
          eval(this.getFormula());
          // this.port.postMessage({ data: "hola", output: outputChannel[i] });

          // outputChannel[i] = inputChannel[i] * 0.5;
        }
      }
      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("custom-proc", CustomProcessor);
