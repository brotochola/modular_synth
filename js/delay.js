class Delay extends Component {
  static name = "Delay";
  constructor(app,serializedData) {
    super(app,serializedData);
    this.infoText =
      "Simple delay line. Echoes the input after delayTime seconds. Patch into delayTime to modulate the delay (chorus, flanger-style sweeps). Keep feedback external with a mixer loop if you want repeats.";

    this.node = new DelayNode(this.app.actx);
    

    // this.createInputButtons();
  }
 

}
