class Delay extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new DelayNode(this.app.actx);
    

    // this.createInputButtons();
  }
 

}
