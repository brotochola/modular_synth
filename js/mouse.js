class Mouse extends Component {
  static name = "Mouse";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Mouse position as CV. Outputs normalized X and Y. Seat select picks which collaborator's cursor drives the module in multiplayer.";
    this.outputLabels = ["X", "Y"];
    this.x = 0;
    this.y = 0;
    this.valuesToSave = ["sourceUserID"];
    this.bindedEventHandler = this.handleMouseMove.bind(this);
    window.addEventListener("mousemove", this.bindedEventHandler);
    this.createSeatSelect();
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
      this.applyCachedRemoteIfNeeded();
      this.sendPos();
    });
  }

  handleMouseMove(e) {
    let x = e.pageX / window.innerWidth;
    let y = e.pageY / window.innerHeight;
    this.app.broadcastLocalInput("mouse", { x, y });
    if (!this.isLocalSeat()) return;
    this.x = x;
    this.y = y;
    this.sendPos();
  }

  sendPos() {
    if (this.node) this.node.port.postMessage({ x: this.x, y: this.y });
    this.flashOutput(0);
    this.flashOutput(1);
  }

  onRemoteInput(msg) {
    if (!msg || msg.device != "mouse") return;
    if (msg.userID != this.sourceUserID) return;
    if (this.isLocalSeat()) return;
    if (msg.x == null || msg.y == null) return;
    this.x = msg.x;
    this.y = msg.y;
    this.sendPos();
  }

  applyCachedRemoteIfNeeded() {
    if (this.isLocalSeat()) return;
    let entry = (this.app.remoteInputs || {})[this.sourceUserID];
    if (!entry || !entry.mouse) return;
    this.x = entry.mouse.x;
    this.y = entry.mouse.y;
    this.sendPos();
  }

  onSeatChanged() {
    this.applyCachedRemoteIfNeeded();
  }

  updateUI() {
    this.refreshSeatSelect();
    this.applyCachedRemoteIfNeeded();
  }

  remove() {
    window.removeEventListener("mousemove", this.bindedEventHandler);
    super.remove();
  }
}
