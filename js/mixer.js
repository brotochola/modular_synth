class Mixer extends Component {
  static name = "Mixer";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Four-channel mixer. Each channel: audio in on top, level fader below (g0…g3), plus master. Patch into g0…g3 to automate levels.";
    this.gainNames = ["g0", "g1", "g2", "g3", "master"];
    this.channelGains = ["g0", "g1", "g2", "g3"];
    // Skip default param rows — channel strips own the jacks + faders
    this.uiParamWidgets = {
      g0: "none",
      g1: "none",
      g2: "none",
      g3: "none",
      master: "none",
      in_0: "none",
      in_1: "none",
      in_2: "none",
      in_3: "none",
    };
    this.createNode();
    this.waitUntilImReady(() => this.createChannelStrips());
  }

  getParamInputLimits(name) {
    if (this.gainNames.includes(name)) {
      return { min: 0, max: 2, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mixerWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "mixer-worklet", {
        numberOfInputs: 4,
        numberOfOutputs: 1,
        parameterData: { g0: 1, g1: 1, g2: 1, g3: 1, master: 1 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  /** Build one jack button and register it in inputElements */
  makeJack(name, label) {
    let button = document.createElement("button");
    button.onclick = (e) => this.onAudioParamClicked(name);
    button.classList.add("input", name);
    button.title = name;
    button.innerText = label || name;
    this.inputElements[name] = { button, textInput: null, knob: null };
    return button;
  }

  createChannelStrips() {
    if (this.faders) return;
    // Drop empty default rows for skipped widgets
    if (this.inputsDiv) this.inputsDiv.innerHTML = "";

    this.faders = document.createElement("div");
    this.faders.className = "faders mixer-strips";
    this.sliders = {};

    for (let i = 0; i < 4; i++) {
      let gainName = this.channelGains[i];
      let inName = "in_" + i;
      let strip = document.createElement("div");
      strip.className = "mixer-strip";

      let audioJack = this.makeJack(inName, "ch" + (i + 1));
      audioJack.classList.add("mixer-audio-in");
      strip.appendChild(audioJack);

      let cvJack = this.makeJack(gainName, gainName);
      cvJack.classList.add("mixer-cv-in");
      strip.appendChild(cvJack);

      let slider = createSlider({
        min: 0,
        max: 2,
        step: 0.01,
        value: this.node.parameters.get(gainName).value,
        vertical: true,
        label: gainName,
        onChange: (val) => this.onFaderInput(gainName, val),
      });
      strip.appendChild(slider.el);
      this.sliders[gainName] = slider;
      this.faders.appendChild(strip);
    }

    // Master strip — spacer (no audio in) + CV jack + fader
    let masterStrip = document.createElement("div");
    masterStrip.className = "mixer-strip mixer-strip-master";
    let spacer = document.createElement("div");
    spacer.className = "mixer-strip-spacer";
    masterStrip.appendChild(spacer);
    let masterJack = this.makeJack("master", "mst");
    masterJack.classList.add("mixer-cv-in");
    masterStrip.appendChild(masterJack);
    let masterSlider = createSlider({
      min: 0,
      max: 2,
      step: 0.01,
      value: this.node.parameters.get("master").value,
      vertical: true,
      label: "master",
      onChange: (val) => this.onFaderInput("master", val),
    });
    masterStrip.appendChild(masterSlider.el);
    this.sliders.master = masterSlider;
    this.faders.appendChild(masterStrip);

    (this.main || this.body || this.container).appendChild(this.faders);
    this.syncFadersFromParams();
  }

  onFaderInput(name, val) {
    val = Number(val);
    this.node.parameters.get(name).value = val;
    this.waitAndSave();
  }

  onParamChanged(event, param) {
    super.onParamChanged(event, param);
    if (this.sliders && this.sliders[param]) {
      this.sliders[param].setValue(event.target.value);
    }
  }

  updateUI() {
    this.syncFadersFromParams();
  }

  syncFadersFromParams() {
    if (!this.sliders || !this.node) return;
    for (let name of this.gainNames) {
      let v = this.node.parameters.get(name).value;
      this.sliders[name].setValue(v);
    }
  }
}
