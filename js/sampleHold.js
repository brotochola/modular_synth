class SampleHold extends Component {
  static name = "Sample & Hold";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sample and hold. Rising edge on clock (in_1) grabs the current signal (in_0) and holds it. No signal patched: samples internal white noise. Stepped random CV, analog-computer classic.";
    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/sampleHoldWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "sample-hold-worklet", {
        numberOfInputs: 2,
        numberOfOutputs: 1,
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  putLabels() {
    super.putLabels();
    let sig = this.container.querySelector("button.in_0");
    if (sig) {
      sig.innerText = "signal";
      sig.title = "signal";
    }
    let clk = this.container.querySelector("button.in_1");
    if (clk) {
      clk.innerText = "clock";
      clk.title = "clock";
    }
  }
}
