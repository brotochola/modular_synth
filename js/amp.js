class Amp extends Component {
  constructor(app) {
    super(app, "gainNode");

    this.node = new GainNode(this.app.actx);
    this.node.parent = this;

    this.createInputButtons();
  }
  // creategainKnob() {
  //   this.gainKnob = document.createElement("input");
  //   this.gainKnob.type = "number";
  //   this.gainKnob.onchange = (e) => this.onInputChange(e);
  //   this.gainKnob.max = 5;
  //   this.gainKnob.min = 0;
  //   this.gainKnob.value = "1";
  //   this.gainKnob.step = 1;
  //   ///appends
  //   this.container.appendChild(this.gainKnob);
  // }

  // onInputChange(e) {
  //   e.stopPropagation();
  //   console.log(this.gainKnob.value);
  //   this.node.gain.setValueAtTime(this.gainKnob.value, 0);
  // }

  createView() {
    // this.createConnectButton();

    // this.creategainKnob();
    makeChildrenStopPropagation(this.container);
  }
}
