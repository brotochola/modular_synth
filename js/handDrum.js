class HandDrum extends Component {
  static name = "Hand Drum";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Hand drum (conga / tumba / bongo). trigger = open tone, slap = bright crack, mute = damped heel. Pitch sets the drum; decay is open-tone length. Tap Drum for an open hit.";
    this.jackKinds = { trigger: "trig", slap: "trig", mute: "trig" };
    this.createNode();
  }

  getParamInputLimits(name) {
    if (name == "trigger" || name == "slap" || name == "mute") {
      return { min: 0, max: 1, step: 0.01 };
    }
    if (name == "pitch") return { min: 60, max: 500, step: 1 };
    if (name == "decay") return { min: 0.05, max: 0.8, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createKickButton() {
    if (this.kickButton) return;
    this.kickButton = document.createElement("button");
    this.kickButton.classList.add("playButton");
    this.kickButton.innerHTML = "Drum";
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
    this.app.loadWorklet("js/audioWorklets/handDrumWorklet.js").then(() => {
      this.node = this.makeWorklet("hand-drum-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          trigger: 0,
          slap: 0,
          mute: 0,
          pitch: 180,
          decay: 0.28,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.createKickButton();
    });
  }
}
