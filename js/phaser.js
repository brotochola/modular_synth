class Phaser extends Component {
  static name = "Phaser";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Six first-order allpasses with an LFO sweeping the coefficient. Knobs: rate (Hz), depth, feedback, mix.";
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "rate") return { min: 0.01, max: 10, step: 0.01 };
    if (name == "depth" || name == "mix") return { min: 0, max: 1, step: 0.01 };
    if (name == "feedback") return { min: 0, max: 0.95, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/phaserWorklet.js").then(() => {
      this.node = this.makeWorklet("phaser-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        parameterData: {
          rate: 0.4,
          depth: 0.7,
          feedback: 0.4,
          mix: 0.5,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
