class SequentialSwitch extends Component {
  static name = "Seq Switch";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Sequential switch (4→1). Rising clock advances which signal input is passed through. Reset jumps to step 1. Steps select locks the ring to 2, 3, or 4. Patch Poly Seq / BPM into clock for round-robin routing.";
    this.steps = serializedData?.steps || 4;
    this.valuesToSave = ["steps"];
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
      .loadWorklet("js/audioWorklets/sequentialSwitchWorklet.js")
      .then(() => {
        this.node = this.makeWorklet("sequential-switch-worklet",
          {
            numberOfInputs: 6,
            numberOfOutputs: 1,
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
    let labels = ["clock", "reset", "1", "2", "3", "4"];
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
