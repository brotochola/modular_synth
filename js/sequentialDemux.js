class SequentialDemux extends Component {
  static name = "Seq Demux";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sequential demux (1→4). Rising clock advances which output gets the signal; other outs stay 0. Reset jumps to out 1. Steps locks the ring to 2, 3, or 4. Patch BPM into signal and a slower clock into clock to send phrases to one sequencer then another.";
    this.steps = serializedData?.steps || 4;
    this.valuesToSave = ["steps"];
    this.outputLabels = ["1", "2", "3", "4"];
    this.createDisplay();
    this.createStepsSelect();
    this.createNode();
  }

  createStepsSelect() {
    this.stepsSelect = document.createElement("select");
    this.stepsSelect.classList.add("type", "ui-select");
    this.stepsSelect.title = "Ring length";
    for (let n of [2, 3, 4]) {
      let opt = document.createElement("option");
      opt.value = n;
      opt.innerHTML = n + " steps";
      this.stepsSelect.appendChild(opt);
    }
    this.stepsSelect.value = this.steps;
    this.stepsSelect.onchange = () => {
      this.steps = Number(this.stepsSelect.value) || 4;
      this.sendSteps();
      this.quickSave();
    };
    if (this.headerLeft) {
      this.headerLeft.appendChild(this.stepsSelect);
    } else {
      (this.main || this.container).appendChild(this.stepsSelect);
    }
  }

  createNode() {
    this.app
      .loadWorklet("js/audioWorklets/sequentialDemuxWorklet.js")
      .then(() => {
        this.node = this.makeWorklet("sequential-demux-worklet",
          {
            numberOfInputs: 3,
            numberOfOutputs: 4,
          },
        );
        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.sendSteps();
        if (this.display) this.display.innerHTML = "1";
      });
  }

  sendSteps() {
    if (!this.node) return;
    this.node.port.postMessage({ steps: this.steps });
  }

  putLabels() {
    super.putLabels();
    let labels = ["clock", "reset", "signal"];
    for (let i = 0; i < labels.length; i++) {
      let btn = this.container.querySelector("button.in_" + i);
      if (btn) {
        btn.innerText = labels[i];
        btn.title = labels[i];
      }
    }
  }

  updateUI() {
    if (this.stepsSelect) this.stepsSelect.value = this.steps;
    this.sendSteps();
  }

  onSabTick() {
    super.onSabTick();
    if (!this.sabBlock || !this.display) return;
    let s = this.sabBlock.getNote() + 1;
    if (s === this._shownStep) return;
    this._shownStep = s;
    this.display.innerHTML = s;
  }
}
