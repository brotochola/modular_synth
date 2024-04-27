class Filter extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = new BiquadFilterNode(this.app.actx);

    this.addTypeSelect()
  }

  addTypeSelect() {
    this.typeSelect = document.createElement("select");
    this.typeSelect.classList.add("type");
    this.typeOptions = ["lowpass", "highpass", "bandpass", "notch"];
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
    this.app.quickSave();
  }

  updateUI() {
    this.typeSelect.value = this.node.type;
  }
}
