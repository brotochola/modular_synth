class LerpComponent extends Component {
  static name = "lerp";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Slew / lerp. Smoothly moves its output toward the input over the time parameter (seconds). Use it to glide CV, soften stepped sequences, or lag noisy signals. Patch into time to automate the glide speed.";

    this.val = 0;
    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/lerpWorklet.js").then(() => {
      this.node = this.makeWorklet("lerp-processor", {
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
