class Amp extends Component {
  static name = "Gain";
  constructor(app,serializedData) {
    super(app,serializedData);

    this.node = new GainNode(this.app.actx);
    
    this.infoText="Gain Node / Amplifier. It multiplies the input signal by the number put here"

    // this.createInputButtons();
  }
  

 
}
