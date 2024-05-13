class Sequencer extends Component {
  static oneSemitone = 1.059463;
  constructor(app, serializedData) {
    super(app, serializedData);
    this.valuesToSave = ["sequence"];

    this.numberOfSemitones = 13;
    this.numberOfSteps = 16;
    if (!this.sequence) this.initSequence();
    this.outputLabels = ["relative note", "trigger"];
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
    this.container.appendChild(this.buttonsContainer);
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
    this.container.querySelectorAll("button").forEach((button) => {
      button.classList.remove("active");
    });

    for (let i = 0; i < this.numberOfSemitones; i++) {
      for (let j = 0; j < this.numberOfSteps; j++) {
        if (this.sequence[j][i]) {
          this.container
            .querySelector(
              "button[time='" + j + "'][semitone='" + (i + 1) + "']"
            )
            .classList.add("active");
        }
      }
    }
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
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/sequencerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "sequencer-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 2,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.sendToWorklet();

        // this.node.port.onmessage = (e) => console.log("########", e.data);

        // this.createInputButtons();
      });
  }

  serialize() {
    let obj = super.serialize();
    if (this.sequence)
      obj.sequence = arrayToObject(
        this.sequence.map((k) => k.map((b) => (b ? 1 : 0)))
      );
    return obj;
  }
}
