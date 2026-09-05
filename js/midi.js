class Midi extends Component {
  static name = "MIDI";
  static MAX_OUTS = 31;
  static CC_START = 10;
  static BASE_KEYS = [
    "freq1",
    "freq2",
    "freq3",
    "freq4",
    "vel1",
    "vel2",
    "vel3",
    "vel4",
    "modWheel",
    "pitchBend",
  ];
  static BASE_LABELS = [
    "freq1",
    "freq2",
    "freq3",
    "freq4",
    "vel1",
    "vel2",
    "vel3",
    "vel4",
    "mod",
    "pitch",
  ];

  static shiftOldOut(idx) {
    idx = parseInt(idx, 10) || 0;
    if (idx >= 7) return idx + 3;
    if (idx === 5) return 8;
    if (idx === 6) return 9;
    return idx;
  }

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Hardware MIDI in. Notes map to freq1–4 + vel1–4; mod wheel and pitch bend are always available. Pads and CCs appear as new outputs when you touch them.";
    this.notesOn = {};
    this.outputLabels = Midi.BASE_LABELS.slice();
    while (this.outputLabels.length < Midi.MAX_OUTS) this.outputLabels.push("");
    this.outputKinds = {};
    for (let i = 0; i < Midi.BASE_KEYS.length; i++) this.outputKinds[i] = "cv";
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
    this.migrateOldOutputs();
    this.syncOutputsUI();
    this.restoreSavedControlChanges();
  }

  migrateOldOutputs() {
    let vo = this.visibleOutputs;
    if (!vo) {
      vo = this.visibleOutputs = {};
      for (let i = 0; i < Midi.BASE_KEYS.length; i++) {
        vo[Midi.BASE_KEYS[i]] = { numOfOutput: i };
      }
      return;
    }
    if (vo.vel1) return;
    let isOld = vo.velocity || (vo.modWheel && vo.modWheel.numOfOutput === 5);
    if (!isOld) return;
    if (vo.velocity) {
      vo.vel1 = vo.velocity;
      delete vo.velocity;
    } else {
      vo.vel1 = { numOfOutput: 4 };
    }
    vo.vel2 = { numOfOutput: 5 };
    vo.vel3 = { numOfOutput: 6 };
    vo.vel4 = { numOfOutput: 7 };
    if (vo.modWheel && vo.modWheel.numOfOutput === 5) {
      vo.modWheel = { numOfOutput: 8 };
    }
    if (vo.pitchBend && vo.pitchBend.numOfOutput === 6) {
      vo.pitchBend = { numOfOutput: 9 };
    }
    for (let key of Object.keys(vo)) {
      if (key.indexOf("control_") !== 0 && key.indexOf("pad_") !== 0) continue;
      let idx = vo[key].numOfOutput;
      if (idx >= 7) vo[key] = { numOfOutput: idx + 3 };
    }
    let saved =
      this.controlChangesToBeSaved ||
      (this.serializedData || {}).controlChangesToBeSaved;
    if (saved) {
      let next = {};
      for (let k of Object.keys(saved)) {
        let n = Number(k) || 0;
        next[n >= 7 ? n + 3 : n] = saved[k];
      }
      this.controlChangesToBeSaved = next;
      if (this.serializedData) this.serializedData.controlChangesToBeSaved = next;
    }
    this._outShift = !!(this.app && this.app.bulkLoading);
    if (!this._outShift) {
      let conns = (this.serializedData || {}).connections;
      if (Array.isArray(conns)) {
        for (let c of conns) {
          if (c && c.from === this.id) {
            c.numberOfOutput = Midi.shiftOldOut(c.numberOfOutput);
          }
        }
      }
    }
  }

  connect(compo, input, numberOfOutput) {
    if (this._outShift) numberOfOutput = Midi.shiftOldOut(numberOfOutput);
    super.connect(compo, input, numberOfOutput);
  }

  restoreSavedControlChanges() {
    let saved = (this.serializedData || {}).controlChangesToBeSaved;
    if (!saved || !this.sabBlock) return;
    for (let k of Object.keys(saved)) {
      this.pushMidi(AppConfig.SAB_EVT_CC, 0, Math.round(saved[k] * 127), Number(k) || 0);
    }
    this.serializedData.controlChangesToBeSaved = null;
  }

  pushMidi(type, a, b, c) {
    if (!this.sabBlock) return;
    this.sabBlock.pushEvent(AppConfig.packEvent(type, a, b, c));
    this.sabBlock.publish();
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
    let numOfOutput = Midi.CC_START;
    for (let k of Object.keys(this.visibleOutputs)) {
      let idx = this.visibleOutputs[k].numOfOutput;
      if (idx >= numOfOutput) numOfOutput = idx + 1;
    }
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
    this.pushMidi(
      AppConfig.SAB_EVT_CC,
      0,
      Math.round(velocity * 127),
      numOfOutput,
    );
    this.flashOutput(numOfOutput);
  }

  onPad(note, velocity) {
    let key = "pad_" + note;
    this.addToVisibleOutputs(key);
    let numOfOutput = (this.visibleOutputs[key] || {}).numOfOutput;
    if (numOfOutput == null) return;
    this.pushMidi(
      AppConfig.SAB_EVT_PAD,
      note,
      velocity > 0 ? Math.round(velocity * 127) : 0,
      numOfOutput,
    );
    this.flashOutput(numOfOutput);
  }

  onModWheel(velocity) {
    if (!this.sabBlock) return;
    this.sabBlock.setSlot(8, velocity);
    this.sabBlock.publish();
  }

  onPitchBend(velocity) {
    if (!this.sabBlock) return;
    this.sabBlock.setSlot(9, velocity);
    this.sabBlock.publish();
  }

  onNote(note, velocity) {
    if (!this.sabBlock) return;
    let vel = velocity > 0 ? Math.round(velocity * 127) : 0;
    this.pushMidi(AppConfig.SAB_EVT_NOTE, note, vel, 0);
    if (velocity) this.notesOn[note] = velocity;
    else delete this.notesOn[note];
    if (velocity) {
      let held = Math.min(Object.keys(this.notesOn).length, 4);
      this.flashOutput(3 + held);
    }
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    let ccIdx = sab.getNote();
    let v = sab.getSlot(16 + (ccIdx & 15));
    if (!this.controlChangesToBeSaved) this.controlChangesToBeSaved = {};
    if (ccIdx >= Midi.CC_START) this.controlChangesToBeSaved[ccIdx] = v;
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/midiWorklet.js").then(() => {
      this.node = this.makeWorklet("midi-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: Midi.MAX_OUTS,
      });
      this.node.onprocessorerror = (e) => console.error(e);
      this.waitUntilImReady(() => {
        this.syncOutputsUI();
        this.restoreSavedControlChanges();
      });
    });
  }
}
