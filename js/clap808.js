class Clap808 extends Component {
  static name = "808 Clap";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 clap. Four noise bursts through a bandpass plus a longer room tail. Rising edge on trigger, or tap Clap. Knobs: tone (BPF Hz), decay (tail), snap (bursts vs tail).";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "tone") return { min: 400, max: 3000, step: 1 };
    if (name == "decay") return { min: 0.05, max: 1, step: 0.01 };
    if (name == "snap") return { min: 0, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Clap";
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
    this.app.loadWorklet("js/audioWorklets/clap808Worklet.js").then(() => {
      this.node = this.makeWorklet("clap808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          tone: 1000,
          decay: 0.35,
          snap: 0.75,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
