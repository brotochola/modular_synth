class Output extends Component {
  constructor(app) {
    super(app, "output");
    this.component = null;
    this.createInput()
  }

  createInput(){
    let button = document.createElement("button");
    button.onclick = (e) => this.onAudioParamClicked("in");
    button.classList.add("input");
    button.classList.add("in");
    this.inputElements["in"] = button;
    button.innerText = "in";
    this.inputsDiv.appendChild(button);
  }

 

  createView() {
    makeChildrenStopPropagation(this.container);
  }
}
