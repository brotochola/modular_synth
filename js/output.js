class Output extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = null;
    this.id = "output";
    this.createInput();
  }

  createInput() {
    let button = document.createElement("button");
    button.onclick = (e) => this.onAudioParamClicked("in");
    button.classList.add("input");
    button.classList.add("in");
    this.inputElements["in"] = { button };
    button.innerText = "in";
    this.inputsDiv.appendChild(button);
  }

  createView() {
    //OVERWRITE THIS METHOD BC THIS COMPONENTS BEHAVES DIFFERENTLY
    makeChildrenStopPropagation(this.container);
    this.ready = true;
  }

  remove() {
    //OVERWRITE THIS METHOD BC THIS COMPONENT YOU CANNOT DELETE
  }
}
