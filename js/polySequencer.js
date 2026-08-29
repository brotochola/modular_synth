class PolySequencer extends Component {
  static name = "Poly Seq";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Polyphonic gate sequencer. 8 lanes × 16 steps. Click toggles a cell. One gate output per lane. Rising clock advances; no clock uses BPM 16ths. Sync checkbox forces project BPM phase and ignores clock. Consecutive hits retrigger (one-sample drop).";
    this.valuesToSave = ["sequence", "syncToBeat"];
    this.syncToBeat =
      serializedData && serializedData.syncToBeat !== undefined
        ? !!serializedData.syncToBeat
        : false;
    this.numberOfLanes = 8;
    this.numberOfSteps = 16;
    this.playheadStep = 0;
    if (!this.sequence) this.initSequence();
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
    this.createNode();
    this.createbuttons();
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
      if (this.node) this.node.port.postMessage({ syncToBeat: this.syncToBeat });
      this.quickSave();
    };
    this.toggleWrap.classList.toggle("on", !!this.syncToBeat);
    this.syncLabel.appendChild(this.syncCheck);
    this.syncLabel.appendChild(document.createTextNode("sync"));
    this.toggleWrap.appendChild(this.syncLabel);
    if (this.headerLeft) this.headerLeft.appendChild(this.toggleWrap);
    else (this.main || this.container).appendChild(this.toggleWrap);
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
    this.buttonsContainer = document.createElement("div");
    this.buttonsContainer.classList.add("buttonsContainer");
    this.laneRows = [];

    for (let i = 0; i < this.numberOfLanes; i++) {
      let row = document.createElement("div");
      row.classList.add("seqLane");
      row.setAttribute("lane", i);
      for (let j = 0; j < this.numberOfSteps; j++) {
        let button = document.createElement("button");
        button.setAttribute("lane", i);
        button.setAttribute("time", j);
        button.classList.add("seqButton");
        button.onclick = (e) => {
          this.handleClickOnSeqButton(e);
        };
        row.appendChild(button);
      }
      this.laneRows[i] = row;
      this.buttonsContainer.appendChild(row);
    }
    if (this.main) {
      this.main.appendChild(this.buttonsContainer);
    } else if (this.body) {
      this.body.appendChild(this.buttonsContainer);
    } else {
      this.container.appendChild(this.buttonsContainer);
    }
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
    if (!Array.isArray(this.sequence)) {
      this.sequence = objectToArray(this.sequence);
    }
    for (let j = 0; j < this.numberOfSteps; j++) {
      if (!Array.isArray(this.sequence[j])) {
        this.sequence[j] = objectToArray(this.sequence[j]);
      }
    }
    this.container.querySelectorAll("button.seqButton").forEach((button) => {
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
    if (!(this.node || {}).port) return;
    this.node.port.postMessage({ clockSkew: this.clockSkew });
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
    this.node.port.postMessage({
      seq: seq,
      bpm: this.app.bpm,
      clockSkew: this.clockSkew || this.app.clockSkew || 0,
      syncToBeat: !!this.syncToBeat,
    });
  }

  createNode() {
    this.app
      .loadWorklet("js/audioWorklets/polySequencerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(
          this.app.actx,
          "poly-sequencer-worklet",
          {
            numberOfInputs: 1,
            numberOfOutputs: 8,
          },
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          if (typeof e.data.currentNote === "number") {
            this.updatePlayhead(e.data.currentNote);
          }
        };

        this.sendToWorklet();
      });
  }

  serialize() {
    let obj = super.serialize();
    if (this.sequence)
      obj.sequence = arrayToObject(
        this.sequence.map((k) => k.map((b) => (b ? 1 : 0))),
      );
    return obj;
  }
}
