class CustomProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      this.formula = e.data;
      this.handleFormulaUpdate(e.data);
    };
    this.functionToExecuteTheFormula = () => {};
  }
  handleFormulaUpdate(formula) {
    this.functionToExecuteTheFormula = eval(
      "((x1,x2,x3,x4,outputChannel,channel1,channel2,channel3,channel4,i)=>{" +
        formula +
        "})"
    );
  }

  process(inputs, outputs) {
    let outputChannel = outputs[0] && outputs[0][0];
    if (!outputChannel) return true;
    let channel1 = (inputs[0] && inputs[0][0]) || null;
    let channel2 = (inputs[1] && inputs[1][0]) || null;
    let channel3 = (inputs[2] && inputs[2][0]) || null;
    let channel4 = (inputs[3] && inputs[3][0]) || null;
    let fn = this.functionToExecuteTheFormula;
    let n = outputChannel.length;
    try {
      for (let i = 0; i < n; ++i) {
        let x1 = channel1 ? channel1[i] || 0 : 0;
        let x2 = channel2 ? channel2[i] || 0 : 0;
        let x3 = channel3 ? channel3[i] || 0 : 0;
        let x4 = channel4 ? channel4[i] || 0 : 0;
        fn(
          x1,
          x2,
          x3,
          x4,
          outputChannel,
          channel1,
          channel2,
          channel3,
          channel4,
          i
        );
      }
    } catch (e) {
      this.port.postMessage(String(e));
    }
    return true;
  }
}
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
registerProcessor("custom-proc", CustomProcessor);
