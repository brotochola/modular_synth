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
      this.node = this.makeWorklet("multiplexor-worklet", {
        numberOfInputs: 8,
        numberOfOutputs: 1,
        parameterData: { which: 0 },
      });

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };

      if (this.display) this.display.innerHTML = "0";
    });
  }

  onSabTick() {
    super.onSabTick();
    if (!this.sabBlock || !this.display) return;
    let w = this.sabBlock.getNote();
    if (w === this._shownWhich) return;
    this._shownWhich = w;
    this.display.innerHTML = w;
  }
}
