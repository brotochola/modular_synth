class Cowbell808 extends Component {
  static name = "808 Cowbell";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 cowbell. Two inharmonic squares (540/800 Hz ratio) through a bandpass. Rising edge on trigger, or tap Cowbell. Knobs: pitch (scales both), tone (BPF Hz), decay.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 200, max: 1200, step: 1 };
    if (name == "tone") return { min: 400, max: 3000, step: 1 };
    if (name == "decay") return { min: 0.05, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Cowbell";
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
    this.app.loadWorklet("js/audioWorklets/cowbell808Worklet.js").then(() => {
      this.node = this.makeWorklet("cowbell808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: 540,
          tone: 900,
          decay: 0.18,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
