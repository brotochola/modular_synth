class Distortion extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createNode();
    // this.customAudioParams = ["amount"];
  }

  handleTriggerFromWorklet(e) {
    console.log("#distortion input", e);
    if (e.current) this.amount = e.current;
    this.node.curve = this.makeDistortionCurve(this.amount);

  }

  makeDistortionCurve(amount = 20) {
    let n_samples = 256,
      curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      let x = (i * 2) / n_samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  createNode() {
    this.node = this.app.actx.createWaveShaper();
    this.node.curve = this.makeDistortionCurve();
  }
}
