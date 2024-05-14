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
  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
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

    if (!this.gamepad) return;

    try {
      this.axes = JSON.parse(JSON.stringify(this.gamepad.axes));
      this.buttons = JSON.parse(
        JSON.stringify(this.gamepad.buttons.map((k) => k.pressed))
      );
    } catch (e) {}

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
      for (let i = 0; i < this.buttons.length + this.axes.length; i++) {
        if (i >= this.buttons.length) {
          let idx = i - this.buttons.length;
          
          if (this.axes[idx] != this.prevAxes[idx]) {
            this.outputElements[i].classList.add("active");
          } else {
            this.outputElements[i].classList.remove("active");
          }
        } else {
          let idx = i;
          if (this.buttons[idx]) {
            this.outputElements[i].classList.add("active");
          } else {
            this.outputElements[i].classList.remove("active");
          }
        }
      }
    }

    if (this.node) {
      this.node.port.postMessage({ axes: this.axes, buttons: this.buttons });
    }

    // this.prevButtons = JSON.parse(JSON.stringify(this.buttons));
    this.prevAxes = JSON.parse(JSON.stringify(this.axes));

    requestAnimationFrame(() => this.runGameLoop());
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/joystickworklet.js")
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

        this.node.port.onmessage = (e) => console.log("#msg", e.data);
      });
  }
}
