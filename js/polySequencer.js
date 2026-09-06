class PolySequencer extends Component {
  static name = "Poly Seq";
  static STEP_OPTIONS = [16, 32, 64, 128];

  constructor(app, serializedData) {
    super(app, serializedData);
    let pulseMs = Math.round(AppConfig.TRIG_PULSE_SEC * 1000);
    this.infoText =
      "Polyphonic trigger sequencer. 8 lanes. Step count 16 / 32 / 64 / 128 (16ths). Click toggles a cell. One trigger output per lane (~" +
      pulseMs +
      "ms pulse on each on-step, including consecutive). Rising clock advances; no clock / sync uses BPM 16ths. Sync checkbox forces project BPM phase and ignores clock.";
    this.valuesToSave = ["sequence", "syncToBeat", "numberOfSteps"];
    this.syncToBeat =
      serializedData && serializedData.syncToBeat !== undefined
        ? !!serializedData.syncToBeat
        : false;
    this.numberOfLanes = 8;
    this.numberOfSteps = PolySequencer.clampSteps(
      serializedData && serializedData.numberOfSteps,
    );
    this.playheadStep = 0;
    if (!this.sequence) this.initSequence();
    this.jackKinds = { in_0: "trig" };
    this.outputLabels = ["1", "2", "3", "4", "5", "6", "7", "8"];
    this.outputKinds = {
      0: "trig",
      1: "trig",
      2: "trig",
      3: "trig",
      4: "trig",
      5: "trig",
      6: "trig",
      7: "trig",
    };
    this.createSyncToggle();
    this.createStepsSelect();
    this.createNode();
    this.createbuttons();
  }

  static clampSteps(n) {
    n = Number(n) || 16;
    let opts = PolySequencer.STEP_OPTIONS;
    let best = opts[0];
    for (let i = 0; i < opts.length; i++) {
      if (Math.abs(opts[i] - n) < Math.abs(best - n)) best = opts[i];
    }
    return best;
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

  createStepsSelect() {
    this.stepsSelect = document.createElement("select");
    this.stepsSelect.classList.add("type", "ui-select", "polyStepsSelect");
    this.stepsSelect.title = "Steps (16ths per loop)";
    for (let n of PolySequencer.STEP_OPTIONS) {
      let opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = n;
      this.stepsSelect.appendChild(opt);
    }
    this.stepsSelect.value = String(this.numberOfSteps);
    this.stepsSelect.onclick = (e) => e.stopPropagation();
    this.stepsSelect.onchange = () => {
      this.setStepCount(Number(this.stepsSelect.value));
    };
    if (this.headerLeft) this.headerLeft.appendChild(this.stepsSelect);
    else (this.main || this.container).appendChild(this.stepsSelect);
  }

  setStepCount(n) {
    n = PolySequencer.clampSteps(n);
    if (n === this.numberOfSteps) return;
    this.resizeSequence(n);
    this.numberOfSteps = n;
    this.rebuildGrid();
    this.quickSave();
  }

  resizeSequence(n) {
    if (!Array.isArray(this.sequence)) {
      this.sequence = objectToArray(this.sequence);
    }
    let old = this.sequence || [];
    let next = [];
    for (let j = 0; j < n; j++) {
      let col = [];
      for (let i = 0; i < this.numberOfLanes; i++) {
        col[i] = !!(old[j] && old[j][i]);
      }
      next[j] = col;
    }
    this.sequence = next;
  }

  initSequence() {
    this.sequence = [];
    for (let j = 0; j < this.numberOfSteps; j++) {
      this.sequence[j] = [];
      for (let i = 0; i < this.numberOfLanes; i++) {
        this.sequence[j][i] = false;
      }
    }
  }

  createbuttons() {
    if (!this.seqGridWrap) {
      this.seqGridWrap = document.createElement("div");
      this.seqGridWrap.classList.add("seqGridWrap");
      if (this.main) this.main.appendChild(this.seqGridWrap);
      else if (this.body) this.body.appendChild(this.seqGridWrap);
      else this.container.appendChild(this.seqGridWrap);
    }
    this.buttonsContainer = document.createElement("div");
    this.buttonsContainer.classList.add("buttonsContainer");
    this.laneRows = [];
    let cols = "repeat(" + this.numberOfSteps + ", 15px) auto";

    for (let i = 0; i < this.numberOfLanes; i++) {
      let row = document.createElement("div");
      row.classList.add("seqLane");
      row.setAttribute("lane", i);
      row.style.gridTemplateColumns = cols;
      for (let j = 0; j < this.numberOfSteps; j++) {
        let button = document.createElement("button");
        button.setAttribute("lane", i);
        button.setAttribute("time", j);
        button.classList.add("seqButton");
        if (j % 16 === 0) button.classList.add("seqBarStart");
        button.onclick = (e) => {
          this.handleClickOnSeqButton(e);
        };
        row.appendChild(button);
      }
      this.laneRows[i] = row;
      this.buttonsContainer.appendChild(row);
    }
    this.seqGridWrap.appendChild(this.buttonsContainer);
    this.applyModuleWidth();
  }

  applyModuleWidth() {
    let w = 36 + this.numberOfSteps * 16 + 52;
    if (w > 1100) w = 1100;
    this.container.style.width = w + "px";
  }

  rebuildGrid() {
    if (this.seqGridWrap) this.seqGridWrap.innerHTML = "";
    this.buttonsContainer = null;
    this.laneRows = [];
    this.outputLedElements = [];
    this.createbuttons();
    if (this.ready && this.node) {
      this.createOutputButton();
      for (let i = 0; i < this.numberOfLanes; i++) {
        this.syncOutputConnected(i);
      }
      if (this.app && this.app.updateAllLines) this.app.updateAllLines();
    }
    this.updateUI();
  }

  createOutputButton() {
    this.outputs = this.buttonsContainer;
    this.outputLedElements = [];
    let n = (this.node || {}).numberOfOutputs || this.numberOfLanes;
    for (let i = 0; i < n; i++) {
      let row = document.createElement("div");
      row.className = "outputJackRow polySeqOut";
      let label = document.createElement("span");
      label.className = "jack-label";
      label.textContent = String(i + 1);
      let led = createLed();
      let outputButton = document.createElement("input");
      outputButton.type = "checkbox";
      outputButton.classList.add("outputButton", "jack");
      outputButton.setAttribute("numberOfOutput", i);
      outputButton.onclick = (e) => {
        this.onOutputClicked(e, outputButton);
      };
      row.appendChild(label);
      row.appendChild(led);
      row.appendChild(outputButton);
      let lane = (this.laneRows && this.laneRows[i]) || this.buttonsContainer;
      lane.appendChild(row);
      this.outputLedElements[i] = led;
    }
    this.outputElements = null;
  }

  putLabels() {
    super.putLabels();
    let setJackLabel = (cls, text) => {
      let btn = this.container.querySelector("button." + cls);
      if (!btn) return;
      let lab =
        btn.parentElement && btn.parentElement.querySelector(".jack-label");
      if (lab) {
        lab.textContent = text;
        btn.title = text;
      }
    };
    setJackLabel("in_0", "clock");
  }

  updatePlayhead(step) {
    this.playheadStep = step;
    let root = this.buttonsContainer || this.container;
    if (!root) return;
    root
      .querySelectorAll(".seqButton.seqColumnPlaying")
      .forEach((b) => b.classList.remove("seqColumnPlaying"));
    root
      .querySelectorAll("button[time='" + step + "']")
      .forEach((b) => b.classList.add("seqColumnPlaying"));
    let col = this.sequence && this.sequence[step];
    if (col) {
      for (let lane = 0; lane < this.numberOfLanes; lane++) {
        if (col[lane]) this.flashOutput(lane);
      }
    }
  }

  handleClickOnSeqButton(e) {
    let but = e.target;
    let lane = Number(but.getAttribute("lane"));
    let time = Number(but.getAttribute("time"));
    this.sequence[time][lane] = !this.sequence[time][lane];
    this.quickSave();
    this.updateUI();
  }

  updateUI() {
    this.numberOfSteps = PolySequencer.clampSteps(this.numberOfSteps);
    if (!Array.isArray(this.sequence)) {
      this.sequence = objectToArray(this.sequence);
    }
    if (this.sequence.length !== this.numberOfSteps) {
      this.resizeSequence(this.numberOfSteps);
    }
    for (let j = 0; j < this.numberOfSteps; j++) {
      if (!Array.isArray(this.sequence[j])) {
        this.sequence[j] = objectToArray(this.sequence[j]);
      }
    }
    let buttons = this.container.querySelectorAll("button.seqButton");
    if (buttons.length !== this.numberOfSteps * this.numberOfLanes) {
      this.rebuildGrid();
      return;
    }
    if (this.stepsSelect) this.stepsSelect.value = String(this.numberOfSteps);
    this.applyModuleWidth();
    buttons.forEach((button) => {
      button.classList.remove("active");
    });

    for (let i = 0; i < this.numberOfLanes; i++) {
      for (let j = 0; j < this.numberOfSteps; j++) {
        if (this.sequence[j] && this.sequence[j][i]) {
          let el = this.container.querySelector(
            "button[time='" + j + "'][lane='" + i + "']",
          );
          if (el) el.classList.add("active");
        }
      }
    }
    this.updatePlayhead(this.playheadStep);
    this.sendToWorklet();
  }

  updateBPM() {
    this.sendToWorklet();
  }

  applyClockSkew(skew) {
    this.clockSkew = skew || 0;
    this.writeSabControl();
  }

  sendToWorklet() {
    if (!this.node) return console.warn("poly seq node not ready");
    let seq = [];
    for (let j = 0; j < this.numberOfSteps; j++) {
      seq[j] = [];
      for (let i = 0; i < this.numberOfLanes; i++) {
        seq[j][i] = this.sequence[j] && this.sequence[j][i] ? 1 : 0;
      }
    }
    this.node.port.postMessage({ seq: seq, steps: this.numberOfSteps });
    this.writeSabControl();
  }

  writeSabControl() {
    let sab = this.sabBlock;
    if (!sab) return;
    sab.setBpm(this.app.bpm || 120);
    sab.setSlot(0, this.clockSkew || this.app.clockSkew || 0);
    sab.setSlot(1, this.syncToBeat ? 1 : 0);
    sab.setSlot(2, this.numberOfSteps || 16);
    sab.publish();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    let n = sab.getNote();
    if (n !== this._lastSabNote) {
      this._lastSabNote = n;
      if (typeof this.updatePlayhead === "function") this.updatePlayhead(n);
    }
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/polySequencerWorklet.js").then(() => {
      this.node = this.makeWorklet("poly-sequencer-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 8,
        outputChannelCount: [1, 1, 1, 1, 1, 1, 1, 1],
      });
      this.silentGain = this.app.actx.createGain();
      this.silentGain.gain.value = 0;
      this.node.connect(this.silentGain);
      this.silentGain.connect(this.app.actx.destination);

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };

      this.sendToWorklet();
    });
  }

  serialize() {
    let obj = super.serialize();
    obj.numberOfSteps = this.numberOfSteps;
    if (this.sequence)
      obj.sequence = arrayToObject(
        this.sequence.map((k) => k.map((b) => (b ? 1 : 0))),
      );
    return obj;
  }
}
