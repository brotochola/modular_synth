class Mixer extends Component {
  static name = "Mixer";
  static MAX_CHANNELS = 8;
  static MIN_CHANNELS = 2;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Mixer. Each channel: audio in on top, level fader below (g0…), plus master. + / − add or hide strips (2–8). Unused inputs stay silent. Patch into g0… to automate levels.";
    this.valuesToSave = ["channels"];
    let ch = serializedData && serializedData.channels;
    this.channels = Mixer.clampChannels(ch == null ? 4 : ch);
    this.gainNames = [];
    this.channelGains = [];
    this.uiParamWidgets = { master: "none" };
    for (let i = 0; i < Mixer.MAX_CHANNELS; i++) {
      let g = "g" + i;
      this.gainNames.push(g);
      this.channelGains.push(g);
      this.uiParamWidgets[g] = "none";
      this.uiParamWidgets["in_" + i] = "none";
    }
    this.gainNames.push("master");
    this.createChannelButtons();
    this.createNode();
  }

  static clampChannels(n) {
    n = Number(n) || 4;
    if (n < Mixer.MIN_CHANNELS) n = Mixer.MIN_CHANNELS;
    if (n > Mixer.MAX_CHANNELS) n = Mixer.MAX_CHANNELS;
    return n;
  }

  getParamInputLimits(name) {
    if (this.gainNames.includes(name)) {
      return { min: 0, max: 2, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createChannelButtons() {
    if (this.channelBtns) return;
    this.channelBtns = document.createElement("div");
    this.channelBtns.className = "mixerChannelBtns";
    let minus = document.createElement("button");
    minus.type = "button";
    minus.className = "mixerChBtn";
    minus.textContent = "−";
    minus.title = "Fewer channels";
    minus.onclick = (e) => {
      e.stopPropagation();
      this.setChannelCount(this.channels - 1);
    };
    let plus = document.createElement("button");
    plus.type = "button";
    plus.className = "mixerChBtn";
    plus.textContent = "+";
    plus.title = "More channels";
    plus.onclick = (e) => {
      e.stopPropagation();
      this.setChannelCount(this.channels + 1);
    };
    this.channelBtns.appendChild(minus);
    this.channelBtns.appendChild(plus);
    if (this.headerLeft) this.headerLeft.appendChild(this.channelBtns);
    else (this.main || this.container).appendChild(this.channelBtns);
  }

  setChannelCount(n) {
    n = Mixer.clampChannels(n);
    if (n === this.channels) return;
    this.channels = n;
    this.applyChannelVisibility();
    this.quickSave();
  }

  applyChannelVisibility() {
    if (!this.faders) return;
    let strips = this.faders.querySelectorAll(".mixer-strip:not(.mixer-strip-master)");
    for (let i = 0; i < strips.length; i++) {
      strips[i].classList.toggle("mixer-strip-hidden", i >= this.channels);
    }
    this.container.style.width = 48 * (this.channels + 1) + 28 + "px";
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mixerWorklet.js").then(() => {
      let parameterData = { master: 1 };
      for (let i = 0; i < Mixer.MAX_CHANNELS; i++) parameterData["g" + i] = 1;
      this.node = this.makeWorklet("mixer-worklet", {
        numberOfInputs: Mixer.MAX_CHANNELS,
        numberOfOutputs: 1,
        parameterData,
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
      let slider = this.sliders[name];
      if (slider && document.activeElement === slider.range) continue;
      this.setGainDisplay(name, gains[name]);
    }
  }

  createChannelStrips() {
    if (this.faders) return;
    if (this.inputsDiv) this.inputsDiv.innerHTML = "";

    this.faders = document.createElement("div");
    this.faders.className = "faders mixer-strips";
    this.sliders = {};
    this.gainLabels = {};

    for (let i = 0; i < Mixer.MAX_CHANNELS; i++) {
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
    this.applyChannelVisibility();
    this.createJackActivityMonitor();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab || !this.sliders) return;
    let gains = { master: sab.getSlot(8) };
    for (let i = 0; i < Mixer.MAX_CHANNELS; i++) {
      gains["g" + i] = sab.getSlot(i);
    }
    this.applyLiveGains(gains);
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
    this.channels = Mixer.clampChannels(this.channels);
    this.applyChannelVisibility();
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
