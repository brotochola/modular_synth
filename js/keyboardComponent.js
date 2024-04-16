class KeyboardComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.putEvents();
    this.createNode();
    this.letters = ["a", "s", "d", "z", "x", "c"];
  }

  putLabels() {
    let arr = Array.from(this.container.querySelectorAll(".outputButton"));
    for (let i = 0; i < this.letters.length; i++) {
      let elem = arr[i];
      //   console.log(elem, i, this.letters[i]);
      elem.style.setProperty("--letter", "'" + this.letters[i] + "'");
    }
  }
  putEvents() {
    window.addEventListener("keydown", (e) => this.onKeyDown(e), false);
    window.addEventListener("keyup", (e) => this.onKeyUp(e), false);

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
          numberOfOutputs: this.letters.length,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) =>
          console.log("#keyboard worklet", e.data);
          

        setTimeout(() => this.putLabels(), 150);
      });
  }
}
