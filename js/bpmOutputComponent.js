class BPMOutputComponent extends Component {
  static name = "BPM";
  static RATES = [
    { label: "/16", value: 0.0625 },
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
    this.infoText =
      "BPM clock. Emits pulses locked to the patch BPM. Use the rate select to multiply or divide the clock (halves, doubles, etc.). Patch the output into sequencers, ADSR triggers, MIDI player, or anything that needs a tempo.";
    this.valuesToSave = ["rate"];
    if (serializedData && serializedData.rate != null) {
      this.rate = serializedData.rate;
    } else if (this.rate == null) {
      this.rate = 1;
    }
    this.val = 0;
    this.outputLabels = ["trigger"];
    this.outputKinds = { 0: "trig" };
    this.createNode();
    this.createDisplay();
    this.createRateSelect();
  }

  createRateSelect() {
    this.rateSelect = document.createElement("select");
    this.rateSelect.classList.add("bpmRateSelect", "ui-select");
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
    if (this.headerLeft) {
      this.headerLeft.appendChild(this.rateSelect);
    } else if (this.body) {
      this.body.appendChild(this.rateSelect);
    } else {
      this.container.appendChild(this.rateSelect);
    }
  }

  updateBPM() {
    this.sendToWorklet();
  }

  applyClockSkew(skew) {
    this.clockSkew = skew || 0;
    this.sendToWorklet();
  }

  sendToWorklet() {
    let sab = this.sabBlock;
    if (!sab) return;
    sab.setBpm(this.app.bpm || 120);
    sab.setRate(this.rate || 1);
    sab.setSlot(0, this.clockSkew || this.app.clockSkew || 0);
    sab.publish();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    let n = sab.getNote();
    if (n !== this._lastSabNote) {
      this._lastSabNote = n;
      this.val = n;
      this.updateDisplay();
    }
  }

  updateDisplay() {
    if (this.display) this.display.innerHTML = this.val;
    flashLed(this.displayLed, AppConfig.LED_FLASH_BPM_MS);
  }

  loadFromSerializedData(cb) {
    super.loadFromSerializedData(cb);
    if (this.rateSelect) this.rateSelect.value = String(this.rate);
    this.sendToWorklet();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/bpmOutputWorklet.js").then(() => {
      this.node = this.makeWorklet("bpm-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
      });
      this.sendToWorklet();

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }
}
