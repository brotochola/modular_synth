class Kick808 extends Component {
  static name = "808 Kick";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Analog 808 kick. Rising edge on trigger fires a sine with pitch punch and a short click. Patch a sequencer or BPM clock in, or tap Kick. Knobs: pitch (body Hz), punch (start sweep), decay, click.";
    this.jackKinds = { trigger: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger") return { min: 0, max: 1, step: 0.01 };
    if (name == "pitch") return { min: 20, max: 120, step: 0.1 };
    if (name == "punch") return { min: 0, max: 2000, step: 1 };
    if (name == "decay") return { min: 0.05, max: 2, step: 0.01 };
    if (name == "click") return { min: 0, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Kick";
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
    this.app.loadWorklet("js/audioWorklets/kick808Worklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "kick808-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          pitch: 50,
          punch: 400,
          decay: 0.45,
          click: 0.35,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
