class Text extends Component {
  static name = "Text";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Patch notes. Free-text area saved with the rack — labels, instructions, or reminders. No audio.";
    this.node = null;
    this.ready = true;
    this.createInput();
    this.valuesToSave = ["text"];
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();
    this.textEl.value = this.text || "...";
    this.firstTime=true
  }

  createInput() {
    this.textEl = document.createElement("textarea");
    this.textEl.onclick = e=>{
      if(this.textEl.value=="..." && this.firstTime) {
        this.textEl.value=""
        this.firstTime=false
      }
    }
    this.textEl.oninput = (e) => {
      this.text = this.textEl.value;
      this.waitAndSave();
    };

    if (this.main) {
      this.main.appendChild(this.textEl);
    } else if (this.body) {
      this.body.appendChild(this.textEl);
    } else {
      this.container.appendChild(this.textEl);
    }
  }

  createView() {
    this.ready = true;
    this.createInfoButton();
    if (this.app.patchName) {
      // same path as Component: filter own session + store unsubscribe for remove()
      setTimeout(() => this.startListeningToChangesInThiscomponent(), 2000);
      if (!this.serializedData) this.quickSave(true);
    }
  }
  updateUI() {
    this.textEl.value = this.text;
  }
}
