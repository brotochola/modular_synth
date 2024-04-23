class CounterComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.customAudioParams = ["+", "-"];
    this.val = 0;
    this.createNode();
    this.createDisplay();
  }
  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
  }
  handleTriggerFromWorklet(e) {
    if (e.channelTriggered == 0) {
      this.val++;
    } else {
      this.val--;
    }
    this.updateValueInNode();
    this.updateDisplay();
  }

  updateValueInNode() {
    // debugger
    this.node.port.postMessage({ val: this.val });
  }
  updateDisplay() {
    this.display.innerHTML = this.val;
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/counterWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "counter-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => console.log("#msg", e.data);
      });
  }
}
