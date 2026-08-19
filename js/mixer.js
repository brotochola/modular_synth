class Mixer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Four-channel mixer. Each input has a level fader (g0…g3) and there is a master. Levels are AudioParams: patch into them to automate or sidechain. Same summing as Math Processor y=x1*g0+x2*g1+x3*g2+x4*g3, but with sliders.";
    this.gainNames = ["g0", "g1", "g2", "g3", "master"];
    this.createNode();
    this.waitUntilImReady(() => this.createFaders());
  }

  getParamInputLimits(name) {
    if (this.gainNames.includes(name)) {
      return { min: 0, max: 2, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mixerWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "mixer-worklet", {
        numberOfInputs: 4,
        numberOfOutputs: 1,
        parameterData: { g0: 1, g1: 1, g2: 1, g3: 1, master: 1 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  createFaders() {
    if (this.faders) return;
    this.faders = document.createElement("div");
    this.faders.className = "faders";
    this.sliders = {};
    for (let name of this.gainNames) {
      let col = document.createElement("label");
      col.className = "fader";
      let range = document.createElement("input");
      range.type = "range";
      range.min = 0;
      range.max = 2;
      range.step = 0.01;
      range.value = this.node.parameters.get(name).value;
      range.oninput = (e) => this.onFaderInput(name, e.target.value);
      let cap = document.createElement("span");
      cap.textContent = name;
      col.appendChild(range);
      col.appendChild(cap);
      this.faders.appendChild(col);
      this.sliders[name] = range;
    }
    this.container.appendChild(this.faders);
    this.syncFadersFromParams();
  }

  onFaderInput(name, val) {
    val = Number(val);
    this.node.parameters.get(name).value = val;
    let el = this.inputElements[name];
    if (el && el.textInput) el.textInput.value = val;
    this.waitAndSave();
  }

  onParamChanged(event, param) {
    super.onParamChanged(event, param);
    if (this.sliders && this.sliders[param]) {
      this.sliders[param].value = event.target.value;
    }
  }

  updateUI() {
    this.syncFadersFromParams();
  }

  syncFadersFromParams() {
    if (!this.sliders || !this.node) return;
    for (let name of this.gainNames) {
      let v = this.node.parameters.get(name).value;
      this.sliders[name].value = v;
      let el = this.inputElements[name];
      if (el && el.textInput) el.textInput.value = v;
    }
  }
}
