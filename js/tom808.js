class Tom808 extends Component {
  static name = "808 Tom";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 tom. Sine body with a pitch punch, longer decay than rim. Rising edge on trigger, or tap Tom. Knobs: pitch (~140 Hz), punch, decay.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 50, max: 400, step: 0.1 };
    if (name == "punch") return { min: 0, max: 2000, step: 1 };
    if (name == "decay") return { min: 0.05, max: 1.5, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Tom";
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
    this.app.loadWorklet("js/audioWorklets/tom808Worklet.js").then(() => {
      this.node = this.makeWorklet("tom808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: AppConfig.TOM_HZ,
          punch: 280,
          decay: 0.35,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
