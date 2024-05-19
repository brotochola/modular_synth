class RackCover extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

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
