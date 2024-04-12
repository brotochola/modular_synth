class CompoWorklet extends Component {
  //THIS IS AN EXAMPLE
  constructor(app,serializedData) {
    super(app,serializedData);

    this.app.actx.audioWorklet.addModule("js/audioWorklets/whiteNoiseWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "white-noise-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
     

      // this.createInputButtons();
    });
  }
}
