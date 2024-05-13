class NoiseGenWithWorklet extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Standard white noise generator, which it's actually all possible frequencies at random amplitudes, and/or subsequent random voltage values";

    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/whiteNoiseWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(
          this.app.actx,
          "white-noise-processor",
          {
            numberOfInputs: 0,
            numberOfOutputs: 1,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => console.log("##noise compo", e.data);

        // this.createInputButtons();
      });
  }
}
