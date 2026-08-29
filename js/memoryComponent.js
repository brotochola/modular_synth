class MemoryComponent extends Component {
  static name = "Memory";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sample and hold / memory. Captures and holds the input value when triggered, and shows the stored number. Output stays at the last held level until the next capture.";

    this.createNode();
    this.createDisplay();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/memoryWorklet.js")
      .then(() => {
        this.node = this.makeWorklet("memory-worklet", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
      });
  }

  onSabTick() {
    super.onSabTick();
    if (!this.sabBlock || !this.display) return;
    let v = this.sabBlock.getSlot(0);
    if (v === this.savedValue) return;
    this.savedValue = v;
    this.display.innerHTML = v;
  }
}
