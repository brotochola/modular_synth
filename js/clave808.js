class Clave808 extends Component {
  static name = "808 Clave";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 clave. One short sine (~2.5 kHz) with a slight pitch drop. Rising edge on trigger, or tap Clave. Knobs: pitch, decay.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 800, max: 5000, step: 1 };
    if (name == "decay") return { min: 0.015, max: 0.25, step: 0.001 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Clave";
    this.kickButton.onclick = (e) => {
      e.stopPropagation();
      this.bang();
    };
    (this.main || this.container).appendChild(this.kickButton);
  }

  bang() {
    if (!this.node || !this.node.parameters) return;
    let t = this.node.parameters.get("trigger");
    if (!t) return;
    t.value = 1;
    setTimeout(() => {
      if (this.node && this.node.parameters) {
        this.node.parameters.get("trigger").value = 0;
      }
    }, AppConfig.KICK_BANG_MS);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/clave808Worklet.js").then(() => {
      this.node = this.makeWorklet("clave808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: AppConfig.CLAVE_HZ,
          decay: 0.05,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
