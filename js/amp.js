class Amp extends Component {
  constructor(app) {
    super(app, "gainNode");

    this.node = new GainNode(this.app.actx);
    this.node.parent = this;

    this.createInputButtons();
  }
  

 
}
