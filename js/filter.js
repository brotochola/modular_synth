class Filter extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new BiquadFilterNode(this.app.actx);
    this.node.parent = this;

    // this.createInputButtons();
  }


}
