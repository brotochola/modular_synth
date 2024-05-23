class MemoryComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createNode();
    this.createDisplay();
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/memoryWorklet.js")
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
