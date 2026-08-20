class Sequencer extends Component {
  static name = "Sequencer";
  static oneSemitone = 1.059463;
  constructor(app, serializedData) {
    super(app, serializedData);
    this.valuesToSave = ["sequence"];

    this.numberOfSemitones = 13;
    this.numberOfSteps = 16;
    this.playheadStep = 0;
    if (!this.sequence) this.initSequence();
    this.outputLabels = ["relative note", "trigger", "Hz"];
    this.createNode();
    this.createbuttons();
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
  }

  putLabels() {
    super.putLabels();
    let clockBtn = this.container.querySelector("button.in_0");
    if (clockBtn) {
      clockBtn.innerText = "clock";
      clockBtn.title = "clock";
    }
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

  sendToWorklet() {
    if (!this.node) return console.warn("seq node not ready");
    this.convertArrayOfArraysIntoSmpleArray();
    this.node.port.postMessage({
      seq: this.convertedArray,
      bpm: this.app.bpm,
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
        numberOfOutputs: 3,
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
