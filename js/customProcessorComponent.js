class CustomProcessorComponent extends Component {
  static name = "Math Processor";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Math / logic DSP. Write a JS formula using y (output) and x1…x12 (inputs). Example: y=x1+x2*0.5 mixes; y=(x1**3)/(x1+3) distorts; y=x1 && x2 && x3*100 gates a signal with two buttons.";
    this.formula = serializedData?.formula || "y=x1+x2+x3+x4";
    this.createInfo();
    this.createInputText();
    this.valuesToSave = ["formula"];

    this.createNode();
  }
  createInfo() {
    this.infoBox = document.createElement("p");
    this.infoBox.onclick = (e) => this.toggleActive();
    this.infoBox.innerHTML = "<br>";
    (this.main || this.container).appendChild(this.infoBox);
  }
  createNode() {
    this.app.loadWorklet("js/audioWorklets/customProcessor.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "custom-proc", {
        numberOfInputs: 12,
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
  updateNodeWithFormula() {
    this.updatedFormula = this.formula.replaceAll("y", "outputChannel[i]");
    this.node.port.postMessage(this.updatedFormula);
  }
  handleInputChange(e) {
    e.preventDefault();
    let val = this.inputText.value;
    this.formula = val;
    this.updateNodeWithFormula();
    this.quickSave();
  }

  createInputText() {
    this.inputText = document.createElement("textarea");
    this.inputText.onchange = (e) => this.handleInputChange(e);
    this.inputText.onclick = (e) => {
      this.active ? this.toggleActive() : null;
    };
    this.inputText.value = this.formula;
    (this.main || this.container).appendChild(this.inputText);
  }
  updateUI() {
    this.inputText.value = this.formula;
    this.updateNodeWithFormula();
  }
}
