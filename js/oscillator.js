class Oscillator extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = new OscillatorNode(this.app.actx);
    if(serializedData?.node.type) this.node.type = serializedData.node.type;
    
    
    this.node.frequency.value = Math.floor(150 + Math.random() * 50)
    this.node.start(this.app.getNextBeat());
    // this.createInputButtons();
    this.addTypeSelect();
  }

  addTypeSelect() {
    this.typeSelect = document.createElement("select");
    this.typeSelect.classList.add("type")
    this.typeOptions = ["sine", "square", "sawtooth", "triangle"];
    for (let type of this.typeOptions) {
      let option = document.createElement("option");
      option.innerHTML = type;
      option.value = type;
      this.typeSelect.appendChild(option);
    }
    this.typeSelect.onchange = (e) => this.handleTypeChange(e);
    this.inputsDiv.appendChild(this.typeSelect);
  }
  handleTypeChange(e) {
    this.node.type = this.typeSelect.value;
    this.quickSave()
  }

  updateUI(){
    this.typeSelect.value=this.node.type
  }
}
