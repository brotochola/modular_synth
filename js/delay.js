class Delay extends Component {
  constructor(app) {
    super(app, "delay");

    this.node = new DelayNode(this.app.actx);
    this.node.parent = this;

    this.createInputButtons();
  }
 

}
