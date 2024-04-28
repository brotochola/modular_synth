class BPMOutputComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.val = 0;
    this.createNode();
    this.createDisplay();
  }
  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
  }

  updateBPM(){
    if(!(this.node||{}).port) return
    this.node.port.postMessage({ bpm: this.app.bpm });
  }
  updateDisplay() {
    this.display.innerHTML = this.val;
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/bpmOutputWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "bpm-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
        });
        this.node.port.postMessage({ bpm: this.app.bpm });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {        
          if (e.data.count) {
            this.val = e.data.count;
            this.updateDisplay();
          }
        };
      });
  }
}
