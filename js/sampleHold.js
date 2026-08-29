class SampleHold extends Component {
  static name = "Sample & Hold";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sample and hold. Rising edge on clock (in_1) grabs the current signal (in_0) and holds it. No signal patched: samples internal white noise. Stepped random CV, analog-computer classic.";
    this.jackKinds = { in_0: "audio", in_1: "trig" };
    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/sampleHoldWorklet.js").then(() => {
      this.node = this.makeWorklet("sample-hold-worklet", {
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
    let setJackLabel = (cls, text) => {
      let btn = this.container.querySelector("button." + cls);
      if (!btn) return;
      let lab = btn.parentElement && btn.parentElement.querySelector(".jack-label");
      if (lab) {
        lab.textContent = text;
        btn.title = text;
      }
    };
    setJackLabel("in_0", "signal");
    setJackLabel("in_1", "clock");
  }
}
