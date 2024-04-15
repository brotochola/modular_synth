class Amp extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new GainNode(this.app.actx);
    

    // this.createInputButtons();
  }
  

 
}
