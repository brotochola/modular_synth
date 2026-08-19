class Mouse extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.outputLabels = ["X", "Y"];
    this.x = 0;
    this.y = 0;
    this.bindedEventHandler = this.handleMouseMove.bind(this);
    window.addEventListener("mousemove", this.bindedEventHandler);
    this.createNode();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mouseWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "mouse-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 2,
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.sendPos();
    });
  }

  handleMouseMove(e) {
    this.x = e.pageX / window.innerWidth;
    this.y = e.pageY / window.innerHeight;
    this.sendPos();
  }

  sendPos() {
    if (this.node) this.node.port.postMessage({ x: this.x, y: this.y });
  }

  remove() {
    window.removeEventListener("mousemove", this.bindedEventHandler);
    super.remove();
  }
}
