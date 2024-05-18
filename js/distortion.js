class Distortion extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.amount = 0;

    this.createNode();
    this.customAudioParams = ["amount"];
    this.amountFromInput = 10;
    this.waitUntilImReady(() => this.createInputAmount());
  }
  createInputAmount() {
    this.amountInput = document.createElement("input");
    this.amountInput.type = "number";
    this.amountInput.oninput = () => {
      this.amountFromInput = this.amountInput.value;
      this.makeDistortionCurve();
    };
    this.amountInput.value = this.amountFromInput;
    this.container
      .querySelector("audioparamrow:nth-child(2)")
      .appendChild(this.amountInput);
    this.makeDistortionCurve();
  }

  handleCustomAudioParamChanged(e) {
    if (e.current < 0) return;
    if (e.current != undefined && e.current != null) this.amount = e.current;
    this.node.curve = this.makeDistortionCurve();
  }

  makeDistortionCurve() {
    this.totalAmount = Number(this.amount) + Number(this.amountFromInput || 0);

    let n_samples = 256,
      curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      let x = (i * 2) / n_samples - 1;
      curve[i] =
        ((Math.PI + this.totalAmount) * x) /
        (Math.PI + this.amount * Math.abs(x));
    }
    return curve;
  }

  createNode() {
    this.node = this.app.actx.createWaveShaper();
    this.node.curve = this.makeDistortionCurve();
  }
}
