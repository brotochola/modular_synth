class ConstantValueNode extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = this.app.actx.createConstantSource();
    this.node.start();

    // this.createInputButtons();
  }
}
