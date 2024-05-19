class Text extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = null;
    this.ready = true;
    this.createInput();
    this.valuesToSave = ["text"];
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();
    this.textEl.value = this.text || "...";
  }

  createInput() {
    this.textEl = document.createElement("textarea");
    this.textEl.oninput = (e) => {
      this.text = this.textEl.value;
      this.waitAndSave();
    };

    this.container.appendChild(this.textEl);
  }

  createView() {
    this.ready = true;
    if (this.app.patchName) {
      listenToChangesInComponent(this.app.patchName, this.id, (data) => {
        if (data) this.updateFromSerialized(data);
      });
      if (!this.serializedData) this.quickSave(true);
    }
  }
  updateUI() {
    this.textEl.value = this.text;
  }
}
