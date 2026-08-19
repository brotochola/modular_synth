class EnvelopeGenerator extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.createNode();
  }

  noteOn() {
    this.node.parameters.get("trigger").value = 1;
  }
  noteOff() {
    this.node.parameters.get("trigger").value = 0;
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/adsrWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "adsr-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        channelCount: 1,
        parameterData: {
          attack: 0.5,
          attackcurve: 0.5,
          decay: 0.2,
          sustain: 0.1,
          release: 0.8,
        },
      });
    });
  }
}
