class JoystickComponent extends Component {
  static name = "Gamepad";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.valuesToSave = ["sourceUserID"];
    this.createDisplay();
    this.createSeatSelect();
    this.infoText =
      "If you have a gamepad connected, it will show as many buttons and analog sticks as it comes with";
    this._gameLoopRunning = false;
    this.bindedGamepadConnected = this.onGamepadConnected.bind(this);
    window.addEventListener("gamepadconnected", this.bindedGamepadConnected);
    // Already plugged in before the module was added.
    let pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (let gp of pads) {
      if (gp) {
        this.onGamepadConnected({ gamepad: gp });
        break;
      }
    }
    this.applyCachedRemoteIfNeeded();
  }

  onGamepadConnected(e) {
    this.gamepad = navigator.getGamepads()[e.gamepad.index];
    if (this.isLocalSeat()) {
      this.ensureNodeFromLayout(
        this.gamepad.buttons.length,
        this.gamepad.axes.length
      );
    }
    this.startGameLoop();
  }

  putGamePadNameInDisplay() {
    if (!this.display) return;
    if (!this.gamepad) return;
    if (this.display.innerHTML != this.gamepad.id) {
      this.display.innerHTML = this.gamepad.id;
    }
  }

  startGameLoop() {
    if (this._gameLoopRunning) return;
    this._gameLoopRunning = true;
    this.runGameLoop();
  }

  runGameLoop() {
    if (!this._gameLoopRunning) return;

    this.gamepad = ((navigator.getGamepads && navigator.getGamepads()) || []).filter(
      (k) => k instanceof Gamepad
    )[0];

    this.putGamePadNameInDisplay();

    if (this.gamepad) {
      let nAxes = this.gamepad.axes.length;
      let nButtons = this.gamepad.buttons.length;
      if (!this.axes || this.axes.length !== nAxes) {
        this.axes = new Float32Array(nAxes);
      }
      if (!this.prevAxes || this.prevAxes.length !== nAxes) {
        this.prevAxes = new Float32Array(nAxes);
      }
      if (!this.buttons || this.buttons.length !== nButtons) {
        this.buttons = new Uint8Array(nButtons);
      }
      for (let i = 0; i < nAxes; i++) this.axes[i] = this.gamepad.axes[i];
      for (let i = 0; i < nButtons; i++) {
        this.buttons[i] = this.gamepad.buttons[i].pressed ? 1 : 0;
      }

      this.app.broadcastLocalInput("gamepad", {
        axes: Array.from(this.axes),
        buttons: Array.from(this.buttons),
      });

      if (this.isLocalSeat()) {
        this.ensureNodeFromLayout(nButtons, nAxes);
        this.feedWorkletAndUi(nButtons, nAxes);
      }
    }

    requestAnimationFrame(() => this.runGameLoop());
  }

  feedWorkletAndUi(nButtons, nAxes) {
    if (
      !Array.isArray(this.outputElements) ||
      (this.outputElements || []).length == 0
    ) {
      this.outputElements = Array.from(
        this.container.querySelectorAll("outputs .outputButton")
      );
    }

    if (
      Array.isArray(this.outputElements) &&
      this.outputElements.length &&
      this.outputElements[0] instanceof HTMLElement
    ) {
      this.ensureOutputLeds();
      for (let i = 0; i < nButtons + nAxes; i++) {
        if (i >= nButtons) {
          let idx = i - nButtons;
          let led =
            this.outputLedElements && this.outputLedElements[i];
          if (led) setLedBipolar(led, this.axes[idx] || 0);
          else if (this.axes[idx] != this.prevAxes[idx]) this.flashOutput(i);
        } else {
          this.setOutputActive(i, !!this.buttons[i]);
        }
      }
    }

    if (this.node) {
      this.node.port.postMessage({ axes: this.axes, buttons: this.buttons });
    }

    if (this.prevAxes && this.axes) this.prevAxes.set(this.axes);
  }

  ensureNodeFromLayout(nButtons, nAxes) {
    let total = nButtons + nAxes;
    if (this.node && this.numberOfOutputs == total) return;
    if (this._creatingNode) return;
    this._creatingNode = true;
    this.gamepadLayout = { nButtons, nAxes };
    this.app.loadWorklet("js/audioWorklets/joystickworklet.js").then(() => {
      this.numberOfOutputs = total;
      this.node = new AudioWorkletNode(this.app.actx, "joystick-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: this.numberOfOutputs,
      });

      this.outputLabels = [];
      for (let i = 0; i < this.numberOfOutputs; i++) {
        this.outputLabels[i] = i + 1;
      }

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this._creatingNode = false;
      // Jacks appear once the node exists (createView polls for node).
      this.outputElements = null;
    });
  }

  onRemoteInput(msg) {
    if (!msg || msg.device != "gamepad") return;
    if (msg.userID != this.sourceUserID) return;
    if (this.isLocalSeat()) return;
    let axes = msg.axes;
    let buttons = msg.buttons;
    if (!Array.isArray(axes) || !Array.isArray(buttons)) return;
    this.axes = Float32Array.from(axes);
    this.buttons = Uint8Array.from(buttons);
    if (!this.prevAxes || this.prevAxes.length !== axes.length) {
      this.prevAxes = new Float32Array(axes.length);
    }
    this.ensureNodeFromLayout(buttons.length, axes.length);
    this.feedWorkletAndUi(buttons.length, axes.length);
  }

  applyCachedRemoteIfNeeded() {
    if (this.isLocalSeat()) return;
    let entry = (this.app.remoteInputs || {})[this.sourceUserID];
    if (!entry || !entry.gamepad) return;
    this.onRemoteInput({
      device: "gamepad",
      userID: this.sourceUserID,
      axes: entry.gamepad.axes,
      buttons: entry.gamepad.buttons,
    });
  }

  onSeatChanged() {
    this.applyCachedRemoteIfNeeded();
    if (this.isLocalSeat() && this.gamepad) {
      this.ensureNodeFromLayout(
        this.gamepad.buttons.length,
        this.gamepad.axes.length
      );
    }
  }

  updateUI() {
    this.refreshSeatSelect();
    this.applyCachedRemoteIfNeeded();
  }

  remove() {
    this._gameLoopRunning = false;
    window.removeEventListener("gamepadconnected", this.bindedGamepadConnected);
    super.remove();
  }
}
