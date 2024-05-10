class CounterComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.customAudioTriggers = ["+", "-"];
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
    // console.log(e);
    if (e.channelTriggered == 0 && e.current == 1 && e.lastVal == 0) {
      this.val++;
    } else if (e.channelTriggered == 1 && e.current == 1 && e.lastVal == 0) {
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
