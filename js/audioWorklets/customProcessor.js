class CustomProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "custom-proc");
    this.port.onmessage = (e) => {
      this.formula = e.data;
      this.handleFormulaUpdate(e.data);
    };
    this.functionToExecuteTheFormula = () => {};
    this.channels = new Array(12);
    this.xs = new Float32Array(12);
  }
  handleFormulaUpdate(formula) {
    let args =
      "x1,x2,x3,x4,x5,x6,x7,x8,x9,x10,x11,x12," +
      "outputChannel," +
      "channel1,channel2,channel3,channel4,channel5,channel6," +
      "channel7,channel8,channel9,channel10,channel11,channel12,i";
    this.functionToExecuteTheFormula = new Function(
      args,
      formula,
    );
  }

  process(inputs, outputs) {
    let outputChannel = outputs[0] && outputs[0][0];
    if (!outputChannel) return true;
    let channels = this.channels;
    for (let c = 0; c < 12; c++) {
      channels[c] = (inputs[c] && inputs[c][0]) || null;
    }
    let fn = this.functionToExecuteTheFormula;
    let n = outputChannel.length;
    let xs = this.xs;
    let t0 = currentTime;
    try {
      for (let i = 0; i < n; ++i) {
        for (let c = 0; c < 12; c++) {
          let ch = channels[c];
          xs[c] = ch ? ch[i] : 0;
        }
        fn(
          xs[0], xs[1], xs[2], xs[3], xs[4], xs[5],
          xs[6], xs[7], xs[8], xs[9], xs[10], xs[11],
          outputChannel,
          channels[0], channels[1], channels[2], channels[3],
          channels[4], channels[5], channels[6], channels[7],
          channels[8], channels[9], channels[10], channels[11],
          i,
        );
      }
    } catch (e) {
      if (this.sab) this.sab.setError(1);
    }
    if (this.sab) {
      let dt = (currentTime - t0) * 1000;
      if (dt > 0.5) outputChannel.fill(0);
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
registerProcessor("custom-proc", CustomProcessor);
