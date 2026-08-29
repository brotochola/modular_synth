class Snare808 extends Component {
  static name = "808 Snare";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 snare. Two decaying sines plus highpassed noise. Rising edge on trigger, or tap Snare. Knobs: pitch (body Hz), tone (low/high osc mix), snappy (noise), decay.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 80, max: 400, step: 0.1 };
    if (name == "tone") return { min: 0, max: 1, step: 0.01 };
    if (name == "snappy") return { min: 0, max: 1, step: 0.01 };
    if (name == "decay") return { min: 0.05, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Snare";
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
    this.app.loadWorklet("js/audioWorklets/snare808Worklet.js").then(() => {
      this.node = this.makeWorklet("snare808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: 185,
          tone: 0.45,
          snappy: 0.7,
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
