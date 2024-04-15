class CustomProcessorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.formula = serializedData?.formula || "y=x1*x2";

    this.createInputText();
    this.createNode();
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/customProcessor.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "custom-proc", {
          numberOfInputs: 2,
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
  }

  createInputText() {
    this.inputText = document.createElement("input");
    this.inputText.onchange = (e) => this.handleInputChange(e);
    this.inputText.value = this.formula;
    this.container.appendChild(this.inputText);
  }
}
