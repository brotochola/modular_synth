class NumberDisplayComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createDisplay();

    this.createNode();
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/numberDisplay.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "number-display", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
        });
        this.node.port.onmessage = (e) => this.handleMsgFromWorklet(e);
        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.node.parent = this;
      });
  }
  handleMsgFromWorklet(e) {
    this.display.textContent = e.data.number.toFixed(3);
  }

  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display")
    this.container.appendChild(this.display);
  }
}
