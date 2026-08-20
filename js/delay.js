class Delay extends Component {
  static name = "Delay";
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new DelayNode(this.app.actx);
    

    // this.createInputButtons();
  }
 

}
