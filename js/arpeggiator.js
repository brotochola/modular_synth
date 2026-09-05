class Arpeggiator extends Component {
  static name = "Arpeggiator";
  static MODES = [
    { label: "UP", value: "up" },
    { label: "DOWN", value: "down" },
    { label: "UP-DOWN", value: "upDown" },
  ];

  constructor(app, serializedData) {
    super(app, serializedData);
    let pulseMs = Math.round(AppConfig.TRIG_PULSE_SEC * 1000);
    this.infoText =
      "Arpeggiator (Juno-style). Up to 4 Hz inputs, sorted low to high, expanded by min/max octaves. MODE: up, down, up-down. Rising clock advances; no clock / sync uses project BPM 16ths. Outputs: Hz and trigger (~" +
      pulseMs +
      "ms). Sync checkbox forces project BPM phase and ignores clock.";
    this.valuesToSave = ["syncToBeat", "mode"];
    this.syncToBeat =
      serializedData && serializedData.syncToBeat !== undefined
        ? !!serializedData.syncToBeat
        : false;
    this.mode =
      serializedData && serializedData.mode ? serializedData.mode : "up";
    this.jackKinds = {
      in_0: "trig",
      in_1: "cv",
      in_2: "cv",
      in_3: "cv",
      in_4: "cv",
    };
    this.outputLabels = ["Hz", "trigger"];
    this.outputKinds = { 0: "cv", 1: "trig" };
    this.createSyncToggle();
    this.createModeSelect();
    this.createDisplay();
    this.createNode();
  }

  createSyncToggle() {
    this.toggleWrap = document.createElement("div");
    this.toggleWrap.classList.add("moduleToggles", "seqSyncToggle");
    this.syncLabel = document.createElement("label");
    this.syncLabel.title = "Lock playhead to project BPM (ignore clock jack)";
    this.syncCheck = document.createElement("input");
    this.syncCheck.type = "checkbox";
    this.syncCheck.checked = !!this.syncToBeat;
    this.syncCheck.onchange = () => {
      this.syncToBeat = this.syncCheck.checked;
      this.toggleWrap.classList.toggle("on", this.syncToBeat);
      this.writeSabControl();
      this.quickSave();
    };
    this.toggleWrap.classList.toggle("on", !!this.syncToBeat);
    this.syncLabel.appendChild(this.syncCheck);
    this.syncLabel.appendChild(document.createTextNode("sync"));
    this.toggleWrap.appendChild(this.syncLabel);
    if (this.headerLeft) this.headerLeft.appendChild(this.toggleWrap);
    else (this.main || this.container).appendChild(this.toggleWrap);
  }

  createModeSelect() {
    this.modeSelect = document.createElement("select");
    this.modeSelect.classList.add("type", "ui-select");
    this.modeSelect.title = "Arpeggio direction";
    for (let opt of Arpeggiator.MODES) {
      let el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      this.modeSelect.appendChild(el);
    }
    this.modeSelect.value = this.mode;
    this.modeSelect.onchange = () => {
      this.mode = this.modeSelect.value || "up";
      this.sendMode();
      this.quickSave();
    };
    if (this.headerLeft) this.headerLeft.appendChild(this.modeSelect);
    else (this.main || this.container).appendChild(this.modeSelect);
  }

  modeIndex() {
    if (this.mode === "down") return 1;
    if (this.mode === "upDown") return 2;
    return 0;
  }

  getParamInputLimits(name) {
    if (name == "minOctaves" || name == "maxOctaves") {
      return { min: 0, max: 4, step: 1 };
    }
    return super.getParamInputLimits(name);
  }

  putLabels() {
    super.putLabels();
    let labels = ["clock", "1", "2", "3", "4"];
    for (let i = 0; i < labels.length; i++) {
      let btn = this.container.querySelector("button.in_" + i);
      if (!btn) continue;
      let lab =
        btn.parentElement && btn.parentElement.querySelector(".jack-label");
      if (lab) lab.textContent = labels[i];
      btn.title = labels[i];
    }
  }

  sendMode() {
    if (this.node) this.node.port.postMessage({ mode: this.mode });
    this.writeSabControl();
  }

  writeSabControl() {
    let sab = this.sabBlock;
    if (!sab) return;
    sab.setBpm(this.app.bpm || 120);
    sab.setSlot(16, this.clockSkew || this.app.clockSkew || 0);
    sab.setSlot(17, this.syncToBeat ? 1 : 0);
    sab.setSlot(18, this.modeIndex());
    sab.publish();
  }

  updateBPM() {
    this.writeSabControl();
  }

  applyClockSkew(skew) {
    this.clockSkew = skew || 0;
    this.writeSabControl();
  }

  updateUI() {
    if (this.syncCheck) {
      this.syncCheck.checked = !!this.syncToBeat;
      if (this.toggleWrap)
        this.toggleWrap.classList.toggle("on", !!this.syncToBeat);
    }
    if (this.modeSelect) this.modeSelect.value = this.mode || "up";
    this.sendMode();
  }

  formatHz(hz) {
    if (!(hz > 1)) return "—";
    if (hz >= 100) return hz.toFixed(0);
    if (hz >= 10) return hz.toFixed(1);
    return hz.toFixed(2);
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    let hz = sab.getSlot(0);
    if (this.display && hz !== this._shownHz) {
      this._shownHz = hz;
      this.display.textContent = this.formatHz(hz);
    }
    let trigGen = sab.getSlot(1);
    if (trigGen !== this._lastTrigGen) {
      this._lastTrigGen = trigGen;
      if (hz > 1) this.flashOutput(1);
    }
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/arpeggiatorWorklet.js").then(() => {
      this.node = this.makeWorklet("arpeggiator-worklet", {
        numberOfInputs: 5,
        numberOfOutputs: 2,
        outputChannelCount: [1, 1],
        parameterData: { minOctaves: 0, maxOctaves: 0 },
      });
      this.silentGain = this.app.actx.createGain();
      this.silentGain.gain.value = 0;
      this.node.connect(this.silentGain);
      this.silentGain.connect(this.app.actx.destination);
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.sendMode();
      if (this.display) this.display.textContent = "—";
    });
  }
}
