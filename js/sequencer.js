class Sequencer extends Component {
  static name = "Sequencer";
  static get oneSemitone() {
    return AppConfig.ONE_SEMITONE;
  }
  constructor(app, serializedData) {
    super(app, serializedData);
    let pulseMs = Math.round(AppConfig.TRIG_PULSE_SEC * 1000);
    this.infoText =
      "Step sequencer. 16 steps × 13 semitones grid. Rising clock advances the playhead; no clock / sync uses project BPM 16ths. Outputs: relative note, gate (held while step on), Hz, and trigger (~" +
      pulseMs +
      "ms pulse on each on-step, including consecutive). Sync checkbox forces project BPM phase and ignores clock. Draw notes on the grid; sequence saves with the patch.";
    this.valuesToSave = ["sequence", "syncToBeat"];
    this.syncToBeat =
      serializedData && serializedData.syncToBeat !== undefined
        ? !!serializedData.syncToBeat
        : false;

    this.numberOfSemitones = 13;
    this.numberOfSteps = AppConfig.SEQ_STEPS;
    this.playheadStep = 0;
    if (!this.sequence) this.initSequence();
    this.outputLabels = ["relative note", "gate", "Hz", "trigger"];
    this.outputKinds = { 0: "cv", 1: "gate", 2: "cv", 3: "trig" };
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
      for (let i = 0; i < this.numberOfSemitones; i++) {
        this.sequence[j][i] = false;
      }
    }
  }
  createbuttons() {
    this.buttonsContainer = document.createElement("div");
    this.buttonsContainer.classList.add("buttonsContainer");

    for (let i = 0; i < this.numberOfSemitones; i++) {
      for (let j = 0; j < this.numberOfSteps; j++) {
        let button = document.createElement("button");
        button.setAttribute("semitone", this.numberOfSemitones - i);
        button.setAttribute("time", j);
        button.classList.add("seqButton");
        button.onclick = (e) => {
          this.handleClickOnSeqButton(e);
        };
        this.buttonsContainer.appendChild(button);
      }
    }
    if (this.main) {
      this.main.appendChild(this.buttonsContainer);
    } else if (this.body) {
      this.body.appendChild(this.buttonsContainer);
    } else {
      this.container.appendChild(this.buttonsContainer);
    }
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
    if (col && col.some((b) => !!b)) this.flashOutput(3);
  }

  putLabels() {
    super.putLabels();
    let clockBtn = this.container.querySelector("button.in_0");
    if (!clockBtn) return;
    let lab =
      clockBtn.parentElement &&
      clockBtn.parentElement.querySelector(".jack-label");
    if (lab) lab.textContent = "clock";
    clockBtn.title = "clock";
  }

  handleClickOnSeqButton(e) {
    let but = e.target;

    let semitone = but.getAttribute("semitone");
    let time = but.getAttribute("time");
    let valueToAssign = !this.sequence[time][semitone - 1];

    for (let v = 0; v < this.sequence[time].length; v++) {
      this.sequence[time][v] = false;
    }

    this.sequence[time][semitone - 1] = valueToAssign;
    this.quickSave();

    this.updateUI();
  }

  updateUI() {
    if (!Array.isArray(this.sequence)) {
      this.sequence = objectToArray(this.sequence);
    }
    this.container.querySelectorAll("button.seqButton").forEach((button) => {
      button.classList.remove("active");
    });

    for (let i = 0; i < this.numberOfSemitones; i++) {
      for (let j = 0; j < this.numberOfSteps; j++) {
        if (this.sequence[j][i]) {
          this.container
            .querySelector(
              "button[time='" + j + "'][semitone='" + (i + 1) + "']",
            )
            .classList.add("active");
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
    if (!this.node) return console.warn("seq node not ready");
    this.convertArrayOfArraysIntoSmpleArray();
    this.node.port.postMessage({
      seq: this.convertedArray,
      bpm: this.app.bpm,
      clockSkew: this.clockSkew || this.app.clockSkew || 0,
      syncToBeat: !!this.syncToBeat,
    });
  }

  convertArrayOfArraysIntoSmpleArray() {
    let newArr = [];
    for (let j = 0; j < this.numberOfSteps; j++) {
      let time = this.sequence[j];
      newArr[j] = 0;
      for (let s = 0; s < time.length; s++) {
        if (time[s]) {
          newArr[j] = Sequencer.oneSemitone ** s;
          break;
        }
      }
    }
    this.convertedArray = newArr;
    return newArr;
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/sequencerWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "sequencer-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 4,
      });

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
