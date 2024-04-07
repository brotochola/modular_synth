class Filter extends Component {
  constructor(app) {
    super(app, "filter");

    this.node = new BiquadFilterNode(this.app.actx);
    this.node.parent = this;

    this.createInputButtons();
  }


}
