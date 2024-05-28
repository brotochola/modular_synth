class PitchDetectorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createNode();
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/pitchDetectorWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "yin-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          //   console.log("#pitch detector ", e.data);
        };
      });
  }
}
