class Mixer extends Component {
  static name = "Mixer";
  static CHANNELS = [4, 8, 16];

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Mixer. Each channel: audio in on top, level fader below (g0…), plus master. Channel count 4 / 8 / 16 rebuilds the node — unused strips are not kept. Patch into g0… to automate levels.";
    this.valuesToSave = ["channels"];
    let ch = serializedData && serializedData.channels;
    this.channels = Mixer.clampChannels(ch == null ? 4 : ch);
    this._nodeEpoch = 0;
    this.createChannelSelect();
    this.createNode();
  }

  static clampChannels(n) {
    n = Number(n) || 4;
    if (n <= 4) return 4;
    if (n <= 8) return 8;
    return 16;
  }

  setupGainNames() {
    let n = this.channels;
    this.gainNames = [];
    this.channelGains = [];
    this.uiParamWidgets = { master: "none" };
    for (let i = 0; i < n; i++) {
      let g = "g" + i;
      this.gainNames.push(g);
      this.channelGains.push(g);
      this.uiParamWidgets[g] = "none";
      this.uiParamWidgets["in_" + i] = "none";
    }
    this.gainNames.push("master");
  }

  getParamInputLimits(name) {
    if (this.gainNames && this.gainNames.includes(name)) {
      return { min: 0, max: 2, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createChannelSelect() {
    if (this.chSelect) return;
    this.chSelect = document.createElement("select");
    this.chSelect.className = "type ui-select mixerChSelect";
    this.chSelect.title = "Channel count";
    for (let n of Mixer.CHANNELS) {
      let opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n + " ch";
      this.chSelect.appendChild(opt);
    }
    this.chSelect.value = String(this.channels);
    this.chSelect.onclick = (e) => e.stopPropagation();
    this.chSelect.onchange = () => {
      this.setChannelCount(Number(this.chSelect.value));
    };
    if (this.headerLeft) this.headerLeft.appendChild(this.chSelect);
    else (this.main || this.container).appendChild(this.chSelect);
  }

  readGains() {
    let o = {};
    if (!this.node || !this.node.parameters) return o;
    this.node.parameters.forEach((p, name) => {
      o[name] = p.value;
    });
    return o;
  }

  dropExtraConnections(n) {
    if (!this.app || !this.app.getAllConnections) return;
    let sources = [];
    let list = this.app.getAllConnections().slice();
    for (let i = 0; i < list.length; i++) {
      let conn = list[i];
      if (conn.to !== this) continue;
      let p = conn.audioParam;
      if (p === "master") continue;
      let idx = -1;
      if (String(p).indexOf("in_") === 0) idx = parseInt(p.slice(3), 10);
      else if (/^g\d+$/.test(p)) idx = parseInt(p.slice(1), 10);
      if (!(idx >= n)) continue;
      if (sources.indexOf(conn.from) < 0) sources.push(conn.from);
      conn.remove();
    }
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].quickSave) sources[i].quickSave();
    }
  }

  makeMixerNode(n, gains) {
    n = Mixer.clampChannels(n);
    let parameterData = { master: 1 };
    for (let i = 0; i < n; i++) parameterData["g" + i] = 1;
    if (gains) {
      for (let k in parameterData) {
        if (gains[k] != null) parameterData[k] = Number(gains[k]);
      }
    }
    return this.makeWorklet("mixer-worklet-" + n, {
      numberOfInputs: n,
      numberOfOutputs: 1,
      parameterData,
      processorOptions: { channels: n },
    });
  }

  replaceNode(gains) {
    let n = this.channels;
    let epoch = ++this._nodeEpoch;
    this.app.loadWorklet("js/audioWorklets/mixerWorklet.js").then(() => {
      if (epoch !== this._nodeEpoch) return;
      if (this.node) {
        try {
          this.node.disconnect();
        } catch (e) {}
      }
      this.node = this.makeMixerNode(n, gains);
      this.node.parent = this;
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this._peakParamKeys = null;
      if (this.ready) {
        this.rebuildStrips();
        this.resetMyConnections();
      }
    });
  }

  createNode() {
    this.setupGainNames();
    this.replaceNode();
  }

  rebuildGraph(extraGains) {
    this.dropExtraConnections(this.channels);
    let saved = this.readGains();
    if (extraGains) {
      for (let k in extraGains) {
        if (extraGains[k] != null) saved[k] = extraGains[k];
      }
    }
    this.setupGainNames();
    this.replaceNode(saved);
  }

  setChannelCount(n) {
    n = Mixer.clampChannels(n);
    if (this.chSelect) this.chSelect.value = String(n);
    if (n === this.channels && this.node && this.node.numberOfInputs === n) {
      return;
    }
    this.channels = n;
    this.rebuildGraph();
    this.quickSave();
  }

  resize() {
    this.container.style.width = 48 * (this.channels + 1) + 28 + "px";
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

  clearMixerJacks() {
    if (this.inputElements) {
      for (let k of Object.keys(this.inputElements)) {
        if (k === "master" || k.startsWith("in_") || /^g\d+$/.test(k)) {
          delete this.inputElements[k];
        }
      }
    }
    this.jackActivityNames = [];
    this.sliders = {};
    this.gainLabels = {};
  }

  refreshAudioParams() {
    this.audioParams = [];
    for (let i = 0; i < this.channels; i++) this.audioParams.push("in_" + i);
    for (let i = 0; i < this.gainNames.length; i++) {
      this.audioParams.push(this.gainNames[i]);
    }
  }

  rebuildStrips() {
    if (this.faders && this.faders.parentNode) this.faders.remove();
    this.faders = null;
    this.clearMixerJacks();
    this.createChannelStrips();
  }

  createChannelStrips() {
    if (this.faders) return;
    if (this.inputsDiv) this.inputsDiv.innerHTML = "";

    this.faders = document.createElement("div");
    this.faders.className = "faders mixer-strips";
    this.sliders = {};
    this.gainLabels = {};
    let n = this.channels;

    for (let i = 0; i < n; i++) {
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
    this.refreshAudioParams();
    this.syncFadersFromParams();
    this.resize();
    this.createJackActivityMonitor();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab || !this.sliders) return;
    let n = this.channels;
    let gains = { master: sab.getSlot(n) };
    for (let i = 0; i < n; i++) {
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
    if (this.chSelect) this.chSelect.value = String(this.channels);
    if (this.node && this.node.numberOfInputs !== this.channels) {
      this.rebuildGraph(this.serializedData && this.serializedData.audioParams);
      return;
    }
    this.resize();
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

(function mixerClampCheck() {
  if (Mixer.clampChannels(2) !== 4) throw new Error("mixer clamp 2");
  if (Mixer.clampChannels(5) !== 8) throw new Error("mixer clamp 5");
  if (Mixer.clampChannels(9) !== 16) throw new Error("mixer clamp 16");
})();
