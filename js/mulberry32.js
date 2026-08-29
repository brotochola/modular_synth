class Mulberry32 extends Component {
  static name = "Mulberry32";

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Mulberry32 as hash. Same seed → same output always (no free-running stream). Unipolar: [0, 1]. Bipolar checkbox: [-1, 1]. Patch CV into seed to scramble it into a stable random-looking level.";
    this.valuesToSave = ["bipolar"];
    this.bipolar =
      serializedData && serializedData.bipolar !== undefined
        ? !!serializedData.bipolar
        : false;
    this.createToggle();
    this.createNode();
  }

  createToggle() {
    this.toggleWrap = document.createElement("div");
    this.toggleWrap.classList.add("moduleToggles");
    this.bipolarLabel = document.createElement("label");
    this.bipolarCheck = document.createElement("input");
    this.bipolarCheck.type = "checkbox";
    this.bipolarCheck.checked = !!this.bipolar;
    this.bipolarCheck.onchange = () => {
      this.bipolar = this.bipolarCheck.checked;
      if (this.node) this.node.port.postMessage({ bipolar: this.bipolar });
      this.quickSave();
    };
    this.bipolarLabel.appendChild(this.bipolarCheck);
    this.bipolarLabel.appendChild(document.createTextNode(" bipolar"));
    this.toggleWrap.appendChild(this.bipolarLabel);
    (this.main || this.container).appendChild(this.toggleWrap);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/mulberry32Worklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "mulberry32-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: { seed: 0 },
        processorOptions: { bipolar: !!this.bipolar },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  getParamInputLimits(name) {
    if (name == "seed") return { min: 0, max: 4294967295, step: 1 };
    return super.getParamInputLimits(name);
  }

  putLabels() {
    super.putLabels();
    if (this.bipolarCheck) this.bipolarCheck.checked = !!this.bipolar;
  }
}

// ponytail: hash determinism self-check. Upgrade = formal test if API grows.
(function mulberry32SelfCheck() {
  function hash(seed) {
    let a = (seed >>> 0) + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  let a = hash(42);
  let b = hash(42);
  let c = hash(43);
  if (!(a >= 0 && a < 1) || a !== b || a === c) {
    console.error("mulberry32 hash self-check fail", a, b, c);
  }
})();
