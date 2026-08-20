class BPMOutputComponent extends Component {
  static RATES = [
    { label: "/8", value: 0.125 },
    { label: "/4", value: 0.25 },
    { label: "/2", value: 0.5 },
    { label: "x1", value: 1 },
    { label: "*2", value: 2 },
    { label: "*4", value: 4 },
    { label: "*8", value: 8 },
  ];

  constructor(app, serializedData) {
    super(app, serializedData);
    this.valuesToSave = ["rate"];
    if (serializedData && serializedData.rate != null) {
      this.rate = serializedData.rate;
    } else if (this.rate == null) {
      this.rate = 1;
    }
    this.val = 0;
    this.outputLabels = ["trigger"];
    this.createNode();
    this.createDisplay();
    this.createRateSelect();
  }

  createRateSelect() {
    this.rateSelect = document.createElement("select");
    this.rateSelect.classList.add("bpmRateSelect");
    for (let opt of BPMOutputComponent.RATES) {
      let el = document.createElement("option");
      el.value = String(opt.value);
      el.textContent = opt.label;
      this.rateSelect.appendChild(el);
    }
    this.rateSelect.value = String(this.rate);
    this.rateSelect.onchange = () => {
      this.rate = Number(this.rateSelect.value);
      this.sendToWorklet();
      this.quickSave();
    };
    this.container.appendChild(this.rateSelect);
  }

  updateBPM() {
    this.sendToWorklet();
  }

  sendToWorklet() {
    if (!(this.node || {}).port) return;
    this.node.port.postMessage({
      bpm: this.app.bpm,
      rate: this.rate,
    });
  }

  updateDisplay() {
    if (this.display) this.display.innerHTML = this.val;
  }

  loadFromSerializedData(cb) {
    super.loadFromSerializedData(cb);
    if (this.rateSelect) this.rateSelect.value = String(this.rate);
    this.sendToWorklet();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/bpmOutputWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "bpm-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
      });
      this.sendToWorklet();

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };

      this.node.port.onmessage = (e) => {
        if (e.data.count != null) {
          this.val = e.data.count;
          this.updateDisplay();
        }
      };
    });
  }
}
