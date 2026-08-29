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
  }

  getParamInputLimits(name) {
    if (this.gainNames.includes(name)) {
      return { min: 0, max: 2, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mixerWorklet.js").then(() => {
      this.node = this.makeWorklet("mixer-worklet", {
        numberOfInputs: 4,
        numberOfOutputs: 1,
        parameterData: { g0: 1, g1: 1, g2: 1, g3: 1, master: 1 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  createInputButtons() {
    super.createInputButtons();
    this.createChannelStrips();
  }

  /** Build jack row (LED + hole + label) and register in inputElements */
  makeJack(name, label) {
    let wrap = document.createElement("div");
    wrap.className = "jack-row";
    let led = createLed();
    let button = document.createElement("button");
    button.onclick = (e) => this.onAudioParamClicked(name);
    button.classList.add("input", "jack", name);
    button.title = name;
    button.type = "button";
    button.setAttribute("aria-label", label || name);
    let labelEl = document.createElement("span");
    labelEl.className = "jack-label";
    labelEl.textContent = label || name;
    wrap.appendChild(button);
    wrap.appendChild(led);
    wrap.appendChild(labelEl);
    this.inputElements[name] = { button, led, textInput: null, knob: null };
    if (!this.jackActivityNames) this.jackActivityNames = [];
    if (this.jackActivityNames.indexOf(name) < 0) {
      this.jackActivityNames.push(name);
    }
    return wrap;
  }

  makeGainReadout(name) {
    let el = document.createElement("span");
    el.className = "mixer-gain-val";
    el.textContent = "1.00";
    this.gainLabels[name] = el;
    return el;
  }

  formatGain(v) {
    return Number(v).toFixed(2);
  }

  setGainDisplay(name, val) {
    if (this.sliders && this.sliders[name]) {
      this.sliders[name].setValue(val);
    }
    if (this.gainLabels && this.gainLabels[name]) {
      this.gainLabels[name].textContent = this.formatGain(val);
    }
  }

  applyLiveGains(gains) {
    if (!this.sliders) return;
    for (let name of this.gainNames) {
      if (gains[name] == null) continue;
      // Don't fight the pointer while user drags that fader
      let slider = this.sliders[name];
      if (slider && document.activeElement === slider.range) continue;
      this.setGainDisplay(name, gains[name]);
    }
  }

  createChannelStrips() {
    if (this.faders) return;
    // Drop empty default rows for skipped widgets
    if (this.inputsDiv) this.inputsDiv.innerHTML = "";

    this.faders = document.createElement("div");
    this.faders.className = "faders mixer-strips";
    this.sliders = {};
    this.gainLabels = {};

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
      strip.appendChild(this.makeGainReadout(gainName));
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
    masterStrip.appendChild(this.makeGainReadout("master"));
    this.faders.appendChild(masterStrip);

    (this.main || this.body || this.container).appendChild(this.faders);
    this.syncFadersFromParams();
    this.createJackActivityMonitor();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab || !this.sliders) return;
    this.applyLiveGains({
      g0: sab.getSlot(0),
      g1: sab.getSlot(1),
      g2: sab.getSlot(2),
      g3: sab.getSlot(3),
      master: sab.getSlot(4),
    });
  }

  onFaderInput(name, val) {
    val = Number(val);
    this.node.parameters.get(name).value = val;
    if (this.gainLabels && this.gainLabels[name]) {
      this.gainLabels[name].textContent = this.formatGain(val);
    }
    this.waitAndSave();
  }

  onParamChanged(event, param) {
    super.onParamChanged(event, param);
    if (this.sliders && this.sliders[param]) {
      this.setGainDisplay(param, event.target.value);
    }
  }

  updateUI() {
    this.syncFadersFromParams();
  }

  syncFadersFromParams() {
    if (!this.sliders || !this.node) return;
    for (let name of this.gainNames) {
      let v = this.node.parameters.get(name).value;
      this.setGainDisplay(name, v);
    }
  }
}
