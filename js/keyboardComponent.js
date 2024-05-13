class KeyboardComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.putEvents();
    this.createNode();
    this.outputLabels = ["a", "s", "d", "f", "z", "x", "c"];
    this.letters=this.outputLabels
  }

  putEvents() {
    this.bindedKeyUp = this.onKeyUp.bind(this);
    this.bindedKeyDown = this.onKeyDown.bind(this);
    window.addEventListener("keydown", this.bindedKeyDown, false);
    window.addEventListener("keyup", this.bindedKeyUp, false);
  }
  onKeyDown(e) {
    for (let i = 0; i < this.letters.length; i++) {
      if (e.key == this.letters[i]) {
        this.node.port.postMessage({ type: "down", which: i });
        break;
      }
    }
  }
  onKeyUp(e) {
    for (let i = 0; i < this.letters.length; i++) {
      if (e.key == this.letters[i]) {
        this.node.port.postMessage({ type: "up", which: i });
        break;
      }
    }
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/keyboardWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "keyboard-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: this.outputLabels.length,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) =>
          console.log("#keyboard worklet", e.data);
      });
  }
  remove() {
    window.removeEventListener("keydown", this.bindedKeyDown, false);
    window.removeEventListener("keyup", this.bindedKeyUp, false);
    super.remove();
  }
}
