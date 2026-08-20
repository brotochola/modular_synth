class Compressor extends Component {
  static name = "Compressor";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = new DynamicsCompressorNode(this.app.actx);

    // this.createInputButtons();
  }
}
