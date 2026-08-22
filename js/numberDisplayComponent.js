class NumberDisplayComponent extends Component {
  static name = "Number Display";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Number display. Shows the current value of the input signal (about 3 decimals). Useful for debugging CV and reading LFOs or envelopes.";

    this.createDisplay();

    this.createNode();
  }
  createNode() {
    this.app.loadWorklet("js/audioWorklets/numberDisplay.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "number-display", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
        });
        this.node.port.onmessage = (e) => this.handleMsgFromWorklet(e);
        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        
      });
  }
  handleMsgFromWorklet(e) {
    this.display.textContent = e.data.number.toFixed(3);
  }


}
