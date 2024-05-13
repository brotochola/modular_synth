class CustomProcessorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "This is most interesting component. It allows you to do whatever math formula you want with the 4 available input signals.<br>For example, if you have two inputs and the formula goes like 'y=x1+x2*0.5' at the output you'll have the sum of both signals, but the second input will have 50% of its amplitud. This is what analogs mixers do.<br>Something like 'y=(x1**3)/(x1+3)' creates a cool distortion.<br>It's also interesting to point out that this module can be used for logic operations, so let's say you have a gamepad connected and you want to change some parameter with the analog stick, but only when 2 buttons are pressed, so: 'y=x1 && x2 && x3*100', being X3 the value from the analog stick";
    this.formula = serializedData?.formula || "y=x1+x2+x3+x4";
    this.createInfo();
    this.createInputText();
    this.valuesToSave = ["formula"];

    this.createNode();
  }
  createInfo() {
    this.infoBox = document.createElement("p");
    this.infoBox.onclick = (e) => this.toggleActive();
    this.infoBox.innerText =
      "y is the output, x1, x2, x3, x4 are the 4 inputs at each frame, but also you can use it like: inputChannel1[i], being the i between 0 and 127";
    this.container.appendChild(this.infoBox);
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
    // e.stopPropagating()
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
    this.container.appendChild(this.inputText);
  }
  updateUI() {
    this.inputText.value = this.formula;
    this.updateNodeWithFormula();
  }
}
