class Distortion extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.amount = 20;

    this.createNode();
    this.customAudioParams = ["amount"];
  }

  handleCustomAudioParamChanged(e) {
    console.log("#distortion input", e);
    if (e.current < 0) return;
    if (e.current) this.amount = e.current;
    this.node.curve = this.makeDistortionCurve();
  }

  makeDistortionCurve() {
    let n_samples = 256,
      curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      let x = (i * 2) / n_samples - 1;
      curve[i] =
        ((Math.PI + this.amount) * x) / (Math.PI + this.amount * Math.abs(x));
    }
    return curve;
  }

  createNode() {
    this.node = this.app.actx.createWaveShaper();
    this.node.curve = this.makeDistortionCurve();
  }
}
