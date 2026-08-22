class RackCover extends Component {
  static name = "Rack Cover";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Blank rack panel. Resize it to cover cables or group modules visually. No audio — layout / decoration only. Size is saved with the patch.";

    this.ready = true;
    this.valuesToSave = ["width", "height"];
    this.startLoop();
  }
  startLoop() {
    this.box = this.container.getBoundingClientRect();
    if (this.width != this.box.width || this.height != this.box.height) {
      this.width = this.box.width;
      this.height = this.box.height;
      this.waitAndSave();
    }

    requestAnimationFrame(() => this.startLoop());
  }
  createView() {
    this.createInfoButton();
    if (this.serializedData) this.updateUI();
    else this.quickSave(true);
  }
  updateUI() {
    if ((this.serializedData || {}).width) {
      this.container.style.width = this.serializedData.width + "px";
      this.container.style.height = this.serializedData.height + "px";
    }
  }
}
