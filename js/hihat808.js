class HiHat808 extends Component {
  static name = "808 HiHat";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 hi-hat. Six inharmonic squares through a highpass. trigger = closed (chokes open), open = open hat. Tap Hat for closed. Knobs: decay (open), tone (HPF Hz).";
    this.jackKinds = { trigger: "trig", open: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger" || name == "open") return { min: 0, max: 1, step: 0.01 };
    if (name == "decay") return { min: 0.05, max: 2, step: 0.01 };
    if (name == "tone") return { min: 2000, max: 12000, step: 1 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Hat";
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
    this.app.loadWorklet("js/audioWorklets/hihat808Worklet.js").then(() => {
      this.node = this.makeWorklet("hihat808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          open: 0,
          decay: 0.35,
          tone: 7000,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
