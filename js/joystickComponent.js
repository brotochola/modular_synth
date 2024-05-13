class JoystickComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    window.addEventListener("gamepadconnected", (e) => {
      this.gamepad = navigator.getGamepads()[e.gamepad.index];
      //   console.log(
      //     `Gamepad connected at index ${gp.index}: ${gp.id}. It has ${gp.buttons.length} buttons and ${gp.axes.length} axes.`
      //   );
      this.createNode();

      this.runGameLoop();
    });
  }

  runGameLoop() {
    this.gamepad = (navigator.getGamepads() || []).filter(
      (k) => k instanceof Gamepad
    )[0];

    if (!this.gamepad) return;

    try {
      this.axes = JSON.parse(JSON.stringify(this.gamepad.axes));
      this.buttons = JSON.parse(
        JSON.stringify(this.gamepad.buttons.map((k) => k.pressed))
      );
    } catch (e) {}

    if (
      Array.isArray(this.outputElements) &&
      this.outputElements.length &&
      this.outputElements[0] instanceof HTMLElement
    ) {
      for (let i = 0; i < this.buttons.length + this.axes.length; i++) {
        if (i >= this.buttons.length) {
          let idx = i - this.buttons.length;
          if (this.axes[idx] != this.prevAxes[idx])
            this.outputElements[i].classList.add("active");
          else this.outputElements[i].classList.remove("active");
        } else {
          let idx = i;
          if (this.buttons[idx]) this.outputElements[i].classList.add("active");
          else this.outputElements[i].classList.remove("active");
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
        this.node = new AudioWorkletNode(this.app.actx, "joystick-worklet", {
          numberOfInputs: 0,
          numberOfOutputs:
            this.gamepad.buttons.length + this.gamepad.axes.length,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => console.log("#msg", e.data);
        setTimeout(() => this.putLabels(), 200);
      });
  }
  putLabels() {
    this.outputElements = Array.from(
      this.container.querySelectorAll(".outputButton")
    );

    for (let i = 0; i < this.outputElements.length; i++) {
      let elem = this.outputElements[i];
      //   console.log(elem, i, this.letters[i]);
      elem.style.setProperty("--letter", "'" + (i + 1) + "'");
    }
  }
}
