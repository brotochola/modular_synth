class LerpComponent extends Component {
  static name = "lerp";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.val = 0;
    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/lerpWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "lerp-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        parameterData: { time: 0.5 },
      });

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
