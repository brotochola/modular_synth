class CustomProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      // console.log(e.data);
      this.formula = e.data;
      this.handleFormulaUpdate(e.data);
      // this.port.postMessage("UPDATED FORMULA " + this.formula);
    };
    this.functionToExecuteTheFormula = () => {};
  }
  handleFormulaUpdate(formula) {
    this.functionToExecuteTheFormula = eval(
      "((x1,x2,x3,x4,outputChannel,i)=>{" + formula + "})"
    );
    this.port.postMessage(this.functionToExecuteTheFormula.toString());
  }
  getFormula() {
    return this.formula;
  }

  process(inputs, outputs) {
    // this.port.postMessage("FORMULA " + this.formula)
    try {
      let outputChannel = ((outputs || [])[0] || [] || [])[0] || [];

      for (let i = 0; i < outputChannel.length; ++i) {
        let x1 = (((inputs || [])[0] || [])[0] || [])[i] || 0;
        let x2 = (((inputs || [])[1] || [])[0] || [])[i] || 0;
        let x3 = (((inputs || [])[2] || [])[0] || [])[i] || 0;
        let x4 = (((inputs || [])[3] || [])[0] || [])[i] || 0;

        this.functionToExecuteTheFormula(x1, x2, x3, x4, outputChannel, i);
      }
      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("custom-proc", CustomProcessor);
