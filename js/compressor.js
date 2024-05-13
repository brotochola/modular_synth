class Compressor extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = new DynamicsCompressorNode(this.app.actx);

    // this.createInputButtons();
  }
}
