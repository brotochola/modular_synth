class Multiplexor extends Component {
  static name = "Multiplexor";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Multiplexor / switch. The which input selects which of the eight signal inputs is passed to the output (integer 0–7).";
    this.which = 0;
    this.createNode();
    this.text = document.createElement("p");
    this.text.innerHTML =
      "The 'which' input (0–7) sets which signal input is passed to the output.";
    (this.main || this.container).appendChild(this.text);
    this.createDisplay();
  }

  getParamInputLimits(name) {
    if (name == "which") return { min: 0, max: 7, step: 1 };
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/multiplexorWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "multiplexor-worklet", {
        numberOfInputs: 8,
        numberOfOutputs: 1,
        parameterData: { which: 0 },
      });

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };

      this.node.port.onmessage = (e) => {
        if (e.data.which != null && this.display) {
          this.display.innerHTML = e.data.which;
        }
      };
      if (this.display) this.display.innerHTML = "0";
    });
  }
}
