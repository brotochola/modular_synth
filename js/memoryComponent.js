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
        this.node = new AudioWorkletNode(this.app.actx, "memory-worklet", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          if (e.data.savedValue) {
            this.savedValue = e.data.savedValue;
            if (this.display.innerHTML != this.savedValue){
              this.display.innerHTML = this.savedValue;
            }
          }
          // console.log("#memory worklet", e.data);
        };
      });
  }
}
