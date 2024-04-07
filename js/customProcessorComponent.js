class CustomProcessorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.formula = serializedData?.formula || "y=1";

    this.createInputText();

    this.createNode();
 
  }
  createNode() {
    this.app.actx.audioWorklet.addModule("js/customProcessor.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "custom-proc", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
      this.node.parent = this;
      this.updateNodeWithFormula();
      // this.node.port.onmessage = (e) => console.log("#msg", e.data);

      this.createInputButtons();
    });
  }
  updateNodeWithFormula() {
    this.inputsDiv.innerHTML = "";
    this.updatedFormula = this.formula
      .replaceAll("y", "outputChannel[i]")
      .replaceAll("x", "inputChannel[i]");

    this.node.port.postMessage(this.updatedFormula);
  }
  handleInputChange(e) {
    let val = this.inputText.value;
    this.formula = val;
    this.updateNodeWithFormula();
    this.createInputButtons();
  }

  createInputText() {
    this.inputText = document.createElement("input");
    this.inputText.onchange = (e) => this.handleInputChange(e);
    this.inputText.value = this.formula;
    this.container.appendChild(this.inputText);
  }
}
