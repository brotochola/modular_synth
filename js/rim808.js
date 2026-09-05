class Rim808 extends Component {
  static name = "808 Rim";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 rimshot. Two short sines (~455 + 1800 Hz) plus a noise click. Rising edge on trigger, or tap Rim. Knobs: pitch, snap (click), decay.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 200, max: 900, step: 1 };
    if (name == "snap") return { min: 0, max: 1, step: 0.01 };
    if (name == "decay") return { min: 0.02, max: 0.4, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Rim";
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
    this.app.loadWorklet("js/audioWorklets/rim808Worklet.js").then(() => {
      this.node = this.makeWorklet("rim808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: AppConfig.RIM_FREQ_LO,
          snap: 0.55,
          decay: 0.08,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
