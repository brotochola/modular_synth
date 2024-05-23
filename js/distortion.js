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
    this.makeDistortionCurve();
  }

  makeDistortionCurve() {
    this.totalAmount = Number(this.amount) + Number(this.amountFromInput || 0);
    this.node.port.postMessage({distortion:this.totalAmount})
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/distortionWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "distortion-worklet", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.updateNodeWithFormula();
        this.node.port.onmessage = (e) => {
          console.warn(this.id + " !!!! :", e.data);
        };
      });
  }
}
