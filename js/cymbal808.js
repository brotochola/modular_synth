class Cymbal808 extends Component {
  static name = "808 Cymbal";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 cymbal. Same six inharmonic squares as the hi-hat, through two bandpasses mixed by tone, then a highpass. Long expo decay. Rising edge on trigger, or tap Cym.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "decay") return { min: 0.2, max: 4, step: 0.01 };
    if (name == "tone") return { min: 0, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Cym";
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
    this.app.loadWorklet("js/audioWorklets/cymbal808Worklet.js").then(() => {
      this.node = this.makeWorklet("cymbal808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          decay: 1.2,
          tone: 0.5,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
