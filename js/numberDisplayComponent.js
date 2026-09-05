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
        this.node = this.makeWorklet("number-display", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });
        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        // ponytail: 0-output worklet is not pulled. Silent tap keeps process() running.
        this.silentGain = this.app.actx.createGain();
        this.silentGain.gain.value = 0;
        this.node.connect(this.silentGain);
        this.silentGain.connect(this.app.actx.destination);
      });
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab || !this.display) return;
    let n = sab.getSlot(0);
    if (Math.abs(n - this._shown) < 0.0005) return;
    this._shown = n;
    this.display.textContent = n.toFixed(3);
  }


}
