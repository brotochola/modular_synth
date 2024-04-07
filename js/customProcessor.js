class CustomProcessor extends AudioWorkletProcessor {
  constructor(){
    super()
    this.port.onmessage = (e) => {
      console.log(e.data);
      this.formula=e.data
      // this.port.postMessage("pong");
    };
  }
  getFormula(){
    return this.formula
  }

  process(inputs, outputs) {
    let input = inputs[0];
    let output = outputs[0];

    for (let channel = 0; channel < input.length; ++channel) {
      let inputChannel = input[channel];
      let outputChannel = output[channel];
      for (let i = 0; i < inputChannel.length; ++i) {
        eval(this.getFormula())
        // outputChannel[i] = inputChannel[i] * 0.5;
      }
    }

    return true;
  }
}


registerProcessor("custom-proc", CustomProcessor);