class Output extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = null;
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

    listenToChangesInDoc(this.app.patchName, this.id, (data) => {
      console.log("#changes", this.type, this.id, data)
      this.updateFromSerialized(data);
    });
  }

  remove() {
    //OVERWRITE THIS METHOD BC THIS COMPONENT YOU CANNOT DELETE
  }
}
