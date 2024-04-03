class Oscillator extends Component {
  constructor(app) {
    super(app, "oscillator");

    this.node = new OscillatorNode(this.app.actx);
    this.node.parent = this;
    this.node.frequency.value = 150 + Math.random() * 50;
    this.node.start();
    this.createInputButtons();
  }

  onFreqKnobChange(e) {
    e.stopPropagation();
    console.log(this.freqKnob.value);
    this.node.frequency.setValueAtTime(this.freqKnob.value, 0);
  }

  createFreqKnob() {
    this.freqKnob = document.createElement("input");
    this.freqKnob.type = "range";
    this.freqKnob.oninput = (e) => this.onFreqKnobChange(e);
    this.freqKnob.max = 2000;
    this.freqKnob.min = 0;
    this.freqKnob.value = "200";
    this.freqKnob.step = 0.01;
    ///appends
    this.container.appendChild(this.freqKnob);
  }

  createView() {
    this.createFreqKnob();
    makeChildrenStopPropagation(this.container);
  }
}
