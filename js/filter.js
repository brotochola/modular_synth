class Filter extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new BiquadFilterNode(this.app.actx);
    

    // this.createInputButtons();
  }


}
