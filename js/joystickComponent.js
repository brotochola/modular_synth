class JoystickComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.createDisplay();
    this.infoText =
      "If you have a gamepad connected, it will show as many buttons and analog sticks as it comes with";
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepad = navigator.getGamepads()[e.gamepad.index];
      //   console.log(
      //     `Gamepad connected at index ${gp.index}: ${gp.id}. It has ${gp.buttons.length} buttons and ${gp.axes.length} axes.`
      //   );
      this.createNode();

      this.runGameLoop();
    });
  }

  putGamePadNameInDisplay() {
    if(!this.display) return
    if (this.display.innerHTML != this.gamepad.id) {
      this.display.innerHTML = this.gamepad.id;
    }
  }
  runGameLoop() {
    this.gamepad = (navigator.getGamepads() || []).filter(
      (k) => k instanceof Gamepad
    )[0];

    this.putGamePadNameInDisplay();

    if (!this.gamepad) {
      requestAnimationFrame(() => this.runGameLoop());
      return;
    }

    let nAxes = this.gamepad.axes.length;
    let nButtons = this.gamepad.buttons.length;
    if (!this.axes || this.axes.length !== nAxes) {
      this.axes = new Float32Array(nAxes);
      this.prevAxes = new Float32Array(nAxes);
    }
    if (!this.buttons || this.buttons.length !== nButtons) {
      this.buttons = new Uint8Array(nButtons);
    }
    for (let i = 0; i < nAxes; i++) this.axes[i] = this.gamepad.axes[i];
    for (let i = 0; i < nButtons; i++) {
      this.buttons[i] = this.gamepad.buttons[i].pressed ? 1 : 0;
    }

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
      for (let i = 0; i < nButtons + nAxes; i++) {
        if (i >= nButtons) {
          let idx = i - nButtons;
          if (this.axes[idx] != this.prevAxes[idx]) {
            this.outputElements[i].classList.add("active");
          } else {
            this.outputElements[i].classList.remove("active");
          }
        } else if (this.buttons[i]) {
          this.outputElements[i].classList.add("active");
        } else {
          this.outputElements[i].classList.remove("active");
        }
      }
    }

    if (this.node) {
      this.node.port.postMessage({ axes: this.axes, buttons: this.buttons });
    }

    this.prevAxes.set(this.axes);

    requestAnimationFrame(() => this.runGameLoop());
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/joystickworklet.js")
      .then(() => {
        this.numberOfOutputs =
          this.gamepad.buttons.length + this.gamepad.axes.length;
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
      });
  }
}
