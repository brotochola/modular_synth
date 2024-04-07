class CompoWorklet extends Component {
  constructor(app) {
    super(app, "worklet");

    this.app.actx.audioWorklet.addModule("js/whiteNoiseWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "white-noise-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
     

      this.createInputButtons();
    });
  }
}
