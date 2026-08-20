class PitchDetectorComponent extends Component {
  static name = "Pitch Detector";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/pitchDetectorWorklet.js")
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
