class Wavefolder extends Component {
  static name = "Wavefolder";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sinusoidal fold, Serge-ish: sin(x * gain * π + offset). Offset tilts the fold (asymmetry). Knobs: gain, offset, mix.";
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "gain") return { min: 0, max: 8, step: 0.01 };
    if (name == "offset") return { min: -1, max: 1, step: 0.01 };
    if (name == "mix") return { min: 0, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/wavefolderWorklet.js").then(() => {
      this.node = this.makeWorklet("wavefolder-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        parameterData: {
          gain: 1,
          offset: 0,
          mix: 1,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
