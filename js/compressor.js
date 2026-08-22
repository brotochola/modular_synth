class Compressor extends Component {
  static name = "Compressor";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Dynamics compressor. Attenuates loud peaks when the signal crosses the threshold, using ratio, knee, attack and release. Useful to even out levels or glue a mix.";

    this.node = new DynamicsCompressorNode(this.app.actx);

    // this.createInputButtons();
  }
}
