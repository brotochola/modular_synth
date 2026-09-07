class Mat extends Component {
  static name = "Mat";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Background mat. Resize and pick a color, then drop modules on it. Drag the cloth to move every overlapping module with it. No audio — layout only. Size and color save with the patch.";

    this.ready = true;
    this.valuesToSave = ["width", "height", "color"];
    this.startLoop();
  }
  startLoop() {
    if (!this.container || !this.container.isConnected) return;
    let w = this.container.offsetWidth;
    let h = this.container.offsetHeight;
    if (this.width != w || this.height != h) {
      this.width = w;
      this.height = h;
      this.waitAndSave();
    }

    requestAnimationFrame(() => this.startLoop());
  }
  applyColor() {
    this.container.style.setProperty("--mat-color", this.color);
  }
  createView() {
    this.color = (this.serializedData || {}).color || this.color || "#4a5c48";
    this.createInfoButton();
    this.colorInput = document.createElement("input");
    this.colorInput.type = "color";
    this.colorInput.className = "matColor";
    this.colorInput.title = "Mat color";
    this.colorInput.value = this.color;
    this.colorInput.onpointerdown = (e) => e.stopPropagation();
    this.colorInput.oninput = () => {
      this.color = this.colorInput.value;
      this.applyColor();
      this.waitAndSave();
    };
    if (this.headerRight) {
      if (this.deleteButton) {
        this.headerRight.insertBefore(this.colorInput, this.deleteButton);
      } else {
        this.headerRight.appendChild(this.colorInput);
      }
    }
    this.applyColor();
    if (this.serializedData) this.updateUI();
    else this.quickSave(true);
  }
  updateUI() {
    let data = this.serializedData || {};
    if (data.width) {
      this.container.style.width = data.width + "px";
      this.container.style.height = data.height + "px";
    }
    if (data.color) {
      this.color = data.color;
      if (this.colorInput) this.colorInput.value = this.color;
      this.applyColor();
    }
  }
}
