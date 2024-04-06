class Oscillator extends Component {
  constructor(app) {
    super(app, "oscillator");

    this.node = new OscillatorNode(this.app.actx);
    this.node.parent = this;
    this.node.frequency.value = 150 + Math.random() * 50;
    this.node.start();
    this.createInputButtons();
    this.addTypeSelect()
  }

  addTypeSelect(){
    this.typeSelect=document.createElement("select");
    this.typeOptions=["sine", "square", "sawtooth","triangle"]
    for(let type of this.typeOptions){
      let option=document.createElement("option")
      option.innerHTML = type
      option.value=type
      this.typeSelect.appendChild(option);
    }
    this.typeSelect.onchange=e=>this.handleTypeChange(e)
    this.inputsDiv.appendChild(this.typeSelect)
  }
  handleTypeChange(e) {
    this.node.type=this.typeSelect.value
  }

  // onFreqKnobChange(e) {
  //   e.stopPropagation();
  //   console.log(this.freqKnob.value);
  //   this.node.frequency.setValueAtTime(this.freqKnob.value, 0);
  // }

  // createFreqKnob() {
  //   this.freqKnob = document.createElement("input");
  //   this.freqKnob.type = "number";
  //   this.freqKnob.onchange = (e) => this.onFreqKnobChange(e);
  //   this.freqKnob.max = 2000;
  //   this.freqKnob.min = 0;
  //   this.freqKnob.value = "200";
  //   this.freqKnob.step = 1
  //   ///appends
  //   this.container.appendChild(this.freqKnob);
  // }

  createView() {
    // this.createFreqKnob();
    makeChildrenStopPropagation(this.container);
  }
}
