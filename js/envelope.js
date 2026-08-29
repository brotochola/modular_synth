class EnvelopeGenerator extends Component {
  static name = "ADSR";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "ADSR envelope. While gate stays high it runs attack then decay to sustain; when gate falls it releases. Patch gate from keys, MIDI, sequencers or BPM. Shape with attack, decay, sustain, release and attackcurve; output modulates amp, filter, etc.";
    this.jackKinds = { gate: "gate" };
    this.createNode();
  }

  noteOn() {
    let p = this.node && this.node.parameters && this.node.parameters.get("gate");
    if (p) p.value = 1;
  }
  noteOff() {
    let p = this.node && this.node.parameters && this.node.parameters.get("gate");
    if (p) p.value = 0;
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
