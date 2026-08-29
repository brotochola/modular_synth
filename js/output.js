class Output extends Component {
  static name = "Output";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = null;
    this.infoText="This is the main output module. Plug something here and hear it"
    this.createInput();
  }

  createInput() {
    let row = document.createElement("div");
    row.className = "jack-row";
    let led = createLed();
    let button = document.createElement("button");
    button.onclick = (e) => this.onAudioParamClicked("in");
    button.classList.add("input", "jack", "in");
    button.title = "in";
    button.type = "button";
    button.setAttribute("aria-label", "in");
    let label = document.createElement("span");
    label.className = "jack-label";
    label.textContent = "in";
    row.appendChild(button);
    row.appendChild(led);
    row.appendChild(label);
    this.inputElements["in"] = { button, led };
    this.inputsDiv.appendChild(row);
  }

  createView() {
    //OVERWRITE THIS METHOD BC THIS COMPONENTS BEHAVES DIFFERENTLY
    makeChildrenStopPropagation(this.container);
    this.createInfoButton()
    this.ready = true;
  }

  remove() {
    //OVERWRITE THIS METHOD BC THIS COMPONENT YOU CANNOT DELETE
  }

  quickSave() {
    setTimeout(() => this.app.afterEdit(), 0);
    this.app.saveListOfComponentsInFirestore()
  }
}
