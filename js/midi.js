class Midi extends Component {
  static name = "MIDI";
  static MAX_OUTS = 31;
  static BASE_KEYS = [
    "freq1",
    "freq2",
    "freq3",
    "freq4",
    "velocity",
    "modWheel",
    "pitchBend",
  ];
  static BASE_LABELS = [
    "freq1",
    "freq2",
    "freq3",
    "freq4",
    "velocity",
    "mod",
    "pitch",
  ];

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Hardware MIDI in. Notes map to freq1–4 + velocity; mod wheel and pitch bend are always available. Pads and CCs appear as new outputs when you touch them.";
    this.notesOn = {};
    this.outputLabels = Midi.BASE_LABELS.slice();
    while (this.outputLabels.length < Midi.MAX_OUTS) this.outputLabels.push("");
    this.outputKinds = {
      0: "cv",
      1: "cv",
      2: "cv",
      3: "cv",
      4: "cv",
      5: "cv",
      6: "cv",
    };
    if (!this.visibleOutputs) {
      this.visibleOutputs = {};
      for (let i = 0; i < Midi.BASE_KEYS.length; i++) {
        this.visibleOutputs[Midi.BASE_KEYS[i]] = { numOfOutput: i };
      }
    }
    this.valuesToSave = ["visibleOutputs", "controlChangesToBeSaved"];
    this.createDisplay();
    if (this.displayLed) this.displayLed.style.display = "none";
    if (this.display) this.display.textContent = "no device";
    this.createNode();
    this.requestMidiAccess();
  }

  requestMidiAccess() {
    if (!navigator.requestMIDIAccess) {
      console.warn("No MIDI support in your browser");
      if (this.display) this.display.textContent = "no MIDI";
      return;
    }
    navigator.requestMIDIAccess({ sysex: false }).then(
      (e) => this.onMIDISuccess(e),
      () => this.onMIDIFailure(),
    );
  }

  onMIDISuccess(midiData) {
    this.midi = midiData;
    let allInputs = this.midi.inputs.values();
    let found = false;
    for (
      let input = allInputs.next();
      input && !input.done;
      input = allInputs.next()
    ) {
      this.device = input;
      if (this.display) this.display.textContent = input.value.name || "MIDI";
      input.value.onmidimessage = (e) => this.gotMIDImessage(e);
      found = true;
    }
    if (!found && this.display) this.display.textContent = "no device";
  }

  onMIDIFailure() {
    console.warn("Not recognising MIDI controller");
    if (this.display) this.display.textContent = "MIDI error";
  }

  labelForKey(key) {
    let bi = Midi.BASE_KEYS.indexOf(key);
    if (bi >= 0) return Midi.BASE_LABELS[bi];
    if (key.indexOf("pad_") == 0) return "pad " + key.slice(4);
    if (key.indexOf("control_") == 0) return "cc " + key.slice(8);
    return key;
  }

  syncOutputsUI() {
    let rows = Array.from(this.container.querySelectorAll(".outputJackRow"));
    if (!rows.length) return;
    let visibleIdx = {};
    for (let key of Object.keys(this.visibleOutputs || {})) {
      let idx = this.visibleOutputs[key].numOfOutput;
      if (idx == null) continue;
      visibleIdx[idx] = true;
      this.outputLabels[idx] = this.labelForKey(key);
      if (key.indexOf("pad_") == 0) this.outputKinds[idx] = "trig";
      else this.outputKinds[idx] = "cv";
    }
    for (let i = 0; i < rows.length; i++) {
      let on = !!visibleIdx[i];
      rows[i].hidden = !on;
      rows[i].style.display = on ? "flex" : "none";
      let lab = rows[i].querySelector(".jack-label");
      let text = this.outputLabels[i] || "";
      if (lab) lab.textContent = text;
      let btn = rows[i].querySelector(".outputButton");
      if (btn) btn.title = text;
    }
  }

  updateUI() {
    this.syncOutputsUI();
    this.restoreSavedControlChanges();
  }

  restoreSavedControlChanges() {
    let saved = (this.serializedData || {}).controlChangesToBeSaved;
    if (!saved || !this.node) return;
    for (let k of Object.keys(saved)) {
      this.node.port.postMessage({
        type: "controlChange",
        velocity: saved[k],
        numOfOutput: k,
      });
    }
    this.serializedData.controlChangesToBeSaved = null;
  }

  gotMIDImessage(messageData) {
    handleMidiMessage(
      messageData,
      this.onNote.bind(this),
      this.onPad.bind(this),
      this.onModWheel.bind(this),
      this.onPitchBend.bind(this),
      this.onControlChange.bind(this),
    );
  }

  addToVisibleOutputs(key) {
    if (this.visibleOutputs[key]) return;
    let numOfOutput = Object.keys(this.visibleOutputs).length;
    if (numOfOutput >= Midi.MAX_OUTS) return;
    this.visibleOutputs[key] = { numOfOutput };
    this.syncOutputsUI();
    this.app.updateAllLines();
    this.quickSave();
  }

  onControlChange(note, velocity) {
    let key = "control_" + note;
    this.addToVisibleOutputs(key);
    let numOfOutput = (this.visibleOutputs[key] || {}).numOfOutput;
    if (numOfOutput == null) return;
    this.node.port.postMessage({
      type: "controlChange",
      velocity,
      numOfOutput,
    });
    this.flashOutput(numOfOutput);
  }

  onPad(note, velocity) {
    let key = "pad_" + note;
    this.addToVisibleOutputs(key);
    let numOfOutput = (this.visibleOutputs[key] || {}).numOfOutput;
    if (numOfOutput == null) return;
    this.node.port.postMessage({
      type: "pad",
      note,
      velocity,
      numOfOutput,
    });
    this.flashOutput(numOfOutput);
  }

  onModWheel(velocity) {
    if (this.node) this.node.port.postMessage({ type: "modWheel", velocity });
  }

  onPitchBend(velocity) {
    if (this.node) this.node.port.postMessage({ type: "pitchBend", velocity });
  }

  onNote(note, velocity) {
    if (!this.node) return;
    this.node.port.postMessage({ type: "note", note, velocity });
    if (velocity) this.notesOn[note] = velocity;
    else delete this.notesOn[note];
    this.node.port.postMessage({ type: "notesOn", notesOn: this.notesOn });
    if (velocity) this.flashOutput(4);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/midiWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "midi-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: Midi.MAX_OUTS,
      });
      this.node.onprocessorerror = (e) => console.error(e);
      this.node.port.onmessage = (e) => {
        if (e.data && e.data.type == "controlChangesToBeSaved") {
          this.controlChangesToBeSaved = e.data.controlChanges;
        }
      };
      this.waitUntilImReady(() => {
        this.syncOutputsUI();
        this.restoreSavedControlChanges();
      });
    });
  }
}
