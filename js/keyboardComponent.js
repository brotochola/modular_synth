class KeyboardComponent extends Component {
  static name = "Keyboard";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Computer keyboard. Each listed key is a gate/CV output (high while held). Pick a multiplayer seat so only that user's keys drive this module.";
    this.outputLabels = [
      "q",
      "w",
      "e",
      "r",
      "t",
      "y",
      "u",
      "i",
      "o",
      "p",
      "a",
      "s",
      "d",
      "f",
      "g",
      "h",
      "j",
      "k",
      "l",
      "z",
      "x",
      "c",
      "v",
      "b",
      "n",
      "m",
    ];
    this.letters = this.outputLabels;
    this.valuesToSave = ["sourceUserID"];
    this.hideOutputActivityLeds = true;
    this.putEvents();
    this.createSeatSelect();
    this.createNode();
  }

  putEvents() {
    this.bindedKeyUp = this.onKeyUp.bind(this);
    this.bindedKeyDown = this.onKeyDown.bind(this);
    window.addEventListener("keydown", this.bindedKeyDown, false);
    window.addEventListener("keyup", this.bindedKeyUp, false);
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey) return;
    for (let i = 0; i < this.letters.length; i++) {
      if (e.key == this.letters[i]) {
        this.app.broadcastLocalInput("keyboard", {
          event: "down",
          which: i,
        });
        if (this.isLocalSeat()) this.sendKey("down", i);
        break;
      }
    }
  }

  onKeyUp(e) {
    if (e.ctrlKey || e.metaKey) return;
    for (let i = 0; i < this.letters.length; i++) {
      if (e.key == this.letters[i]) {
        this.app.broadcastLocalInput("keyboard", {
          event: "up",
          which: i,
        });
        if (this.isLocalSeat()) this.sendKey("up", i);
        break;
      }
    }
  }

  sendKey(type, which) {
    if (this.node) this.node.port.postMessage({ type, which });
    this.setOutputActive(which, type == "down");
  }

  releaseAllKeys() {
    if (!this.node) return;
    for (let i = 0; i < this.letters.length; i++) {
      this.sendKey("up", i);
    }
  }

  onRemoteInput(msg) {
    if (!msg || msg.device != "keyboard") return;
    if (msg.userID != this.sourceUserID) return;
    if (this.isLocalSeat()) return;
    if (msg.event != "down" && msg.event != "up") return;
    if (msg.which == null) return;
    this.sendKey(msg.event, msg.which);
  }

  onSeatChanged(prev, next) {
    if (prev == this.app.userID && next != this.app.userID) {
      this.releaseAllKeys();
    }
  }

  updateUI() {
    this.refreshSeatSelect();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/keyboardWorklet.js").then(() => {
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
