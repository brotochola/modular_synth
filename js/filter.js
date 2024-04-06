class Filter extends Component {
  constructor(app) {
    super(app, "filter");

    this.node = new BiquadFilterNode(this.app.actx);
    this.node.parent = this;

    this.createInputButtons(true);
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
