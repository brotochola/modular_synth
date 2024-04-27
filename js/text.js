class Text extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = null;
    this.createInput();
    this.valuesToSave = ["text"];
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();
    this.textEl.value = this.text || "";
  }

  createInput() {
    this.textEl = document.createElement("textarea");
    this.textEl.oninput = (e) => {
      this.text = this.textEl.value;
      this.app.quickSave()
    };

    this.container.appendChild(this.textEl);
  }

  createView() {
    this.ready = true;
  }
  updateUI() {
    this.textEl.value = this.text;
  }
}
