class MoogLadder extends Component {
  static name = "Moog Ladder";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Four one-pole lowpasses in series with tanh at the input and resonance feedback from the last pole. Self-oscillates near res 1. Knobs: cutoff (Hz), res (0–1.1), drive. No 2x oversample — aliases at high cutoff.";
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "cutoff") return { min: 20, max: 18000, step: 1 };
    if (name == "res") return { min: 0, max: 1.1, step: 0.01 };
    if (name == "drive") return { min: 0.1, max: 4, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/moogLadderWorklet.js").then(() => {
      this.node = this.makeWorklet("moog-ladder-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        parameterData: {
          cutoff: 1000,
          res: 0.3,
          drive: 1,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
