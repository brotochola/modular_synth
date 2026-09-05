class Freeverb extends Component {
  static name = "Freeverb";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Jezar Freeverb. Eight combs and four allpasses, stereo L/R with a 23-sample spread. Mono in duplicated into the tank. Knobs: size (room), damp, wet, width. Convolution reverb stays as Reverb.";
    this.outputLabels = ["L", "R"];
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "size" || name == "damp" || name == "wet" || name == "width") {
      return { min: 0, max: 1, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/freeverbWorklet.js").then(() => {
      this.node = this.makeWorklet("freeverb-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 2,
        outputChannelCount: [1, 1],
        parameterData: {
          size: 0.5,
          damp: 0.5,
          wet: 0.35,
          width: 1,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
