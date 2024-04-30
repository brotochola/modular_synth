class CustomProcessorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.formula = serializedData?.formula || "y=x1+x2+x3+x4";
    this.createInfo();
    this.createInputText();
    this.valuesToSave = ["formula"];

    this.createNode();
  }
  createInfo() {
    this.infoText = document.createElement("p");

    this.infoText.innerText =
      "y is the output, x1, x2, x3 are the 3 inputs at each frame, but also you can use it like: inputChannel1[i], being the i between 0 and 127";
    this.container.appendChild(this.infoText);
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/customProcessor.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "custom-proc", {
          numberOfInputs: 4,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.updateNodeWithFormula();
        this.node.port.onmessage = (e) => console.log("#msg", e.data);
      });
  }
  updateNodeWithFormula() {
    this.updatedFormula = this.formula.replaceAll("y", "outputChannel[i]");
    this.node.port.postMessage(this.updatedFormula);
  }
  handleInputChange(e) {
    let val = this.inputText.value;
    this.formula = val;
    this.updateNodeWithFormula();
    this.quickSave();
  }

  createInputText() {
    this.inputText = document.createElement("textarea");
    this.inputText.onchange = (e) => this.handleInputChange(e);
    this.inputText.value = this.formula;
    this.container.appendChild(this.inputText);
  }
  updateUI() {
    this.inputText.value = this.formula;
    this.updateNodeWithFormula();
  }
}
