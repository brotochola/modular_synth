class Distortion extends Component {
  static name = "Distortion";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Waveshaping distortion. Soft-clips the input; higher amount means more harmonics and grit. Set amount with the number box or automate the amount input.";
    this.uiParamWidgets = { amount: "none" };
    this.createNode();
    this.amountFromInput = 10;
    this.waitUntilImReady(() => this.createInputAmount());
  }
  createInputAmount() {
    this.amountInput = document.createElement("input");
    this.amountInput.type = "number";
    this.amountInput.oninput = () => {
      this.amountFromInput = Number(this.amountInput.value) || 0;
      this.applyAmount();
    };
    this.amountInput.value = this.amountFromInput;
    let row = this.container.querySelector("audioparamrow:nth-child(2)");
    if (row) row.appendChild(this.amountInput);
    this.applyAmount();
  }

  applyAmount() {
    let p = this.node && this.node.parameters && this.node.parameters.get("amount");
    if (p) p.value = Number(this.amountFromInput) || 0;
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/distortionWorklet.js").then(() => {
      this.node = this.makeWorklet("distortion-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        parameterData: { amount: 10 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
