class Sequencer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.bpm = 120;
    this.numberOfSemitones = 12;
    this.numberOfSteps = 16;
    this.initSequence();
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
        button.setAttribute("semitone", this.numberOfSemitones - i - 1);
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
    but.classList.toggle("active");
    let semitone = but.getAttribute("semitone");
    let time = but.getAttribute("time");
    this.sequence[time][semitone] = but.classList.contains("active");
    this.sendToWorklet();
  }

  sendToWorklet() {
    this.node.port.postMessage({
      seq: this.convertArrayOfArraysIntoSmpleArray(this.sequence),
      bpm: this.bpm,
    });
  }

  convertArrayOfArraysIntoSmpleArray(arr) {
    let oneSemitone = 1.059463;
    let newArr = [];
    for (let j = 0; j < this.numberOfSteps; j++) {
      let semitone = this.sequence[j];
      let highestValue = 0;
      for (let i = semitone.length; i >= 0; i--) {
        if (semitone[i] && i > highestValue) {
          highestValue = i * oneSemitone;
        }
      }
      newArr[j] = highestValue;
    }
    return newArr;
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/sequencerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "sequencer-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.node.parent = this;

        this.sendToWorklet();

        this.node.port.onmessage = (e) => console.log("########", e.data);

        // this.createInputButtons();
      });
  }
}
