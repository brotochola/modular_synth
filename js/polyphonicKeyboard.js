class PolyphonicKeyboard extends Component {
  static name = "Polyphonic Keyboard";

  // Z-row = C3 (V=F, G=F#, B=G…), Q-row = C4
  static KEY_TO_MIDI = {
    z: 48,
    s: 49,
    x: 50,
    d: 51,
    c: 52,
    v: 53,
    g: 54,
    b: 55,
    h: 56,
    n: 57,
    j: 58,
    m: 59,
    q: 60,
    2: 61,
    w: 62,
    3: 63,
    e: 64,
    r: 65,
    5: 66,
    t: 67,
    6: 68,
    y: 69,
    7: 70,
    u: 71,
    i: 72,
    9: 73,
    o: 74,
    0: 75,
    p: 76,
  };

  static MIDI_MIN = 48;
  static MIDI_MAX = 76;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "QWERTY piano: Z-row = C3 octave, Q/2/W/3… = C4 up. Up to 8 voices on freq1…freq8 (0 = off, usable as gate). Mini piano highlights held keys; click keys if this is your seat.";
    this.outputLabels = [
      "freq1",
      "freq2",
      "freq3",
      "freq4",
      "freq5",
      "freq6",
      "freq7",
      "freq8",
    ];
    this.pressedMidi = new Set();
    this.pianoKeyEls = {};
    this.valuesToSave = ["sourceUserID"];
    this.putEvents();
    this.createSeatSelect();
    this.createPiano();
    this.createNode();
  }

  isBlackMidi(midi) {
    let n = midi % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
  }

  createPiano() {
    this.piano = document.createElement("div");
    this.piano.classList.add("poly-piano");
    this.piano.onclick = (e) => e.stopPropagation();

    let whites = document.createElement("div");
    whites.classList.add("poly-piano-whites");
    this.piano.appendChild(whites);

    for (let midi = PolyphonicKeyboard.MIDI_MIN; midi <= PolyphonicKeyboard.MIDI_MAX; midi++) {
      if (this.isBlackMidi(midi)) continue;
      let key = document.createElement("div");
      key.classList.add("poly-key", "white");
      key.dataset.midi = String(midi);
      this.bindPianoKey(key, midi);
      whites.appendChild(key);
      this.pianoKeyEls[midi] = key;
    }

    let whiteWidth = 14;
    let blackWidth = 9;
    for (let midi = PolyphonicKeyboard.MIDI_MIN; midi <= PolyphonicKeyboard.MIDI_MAX; midi++) {
      if (!this.isBlackMidi(midi)) continue;
      let whitesBefore = 0;
      for (let m = PolyphonicKeyboard.MIDI_MIN; m < midi; m++) {
        if (!this.isBlackMidi(m)) whitesBefore++;
      }
      let key = document.createElement("div");
      key.classList.add("poly-key", "black");
      key.dataset.midi = String(midi);
      key.style.left = whitesBefore * whiteWidth - blackWidth / 2 + "px";
      this.bindPianoKey(key, midi);
      this.piano.appendChild(key);
      this.pianoKeyEls[midi] = key;
    }

    (this.main || this.container).appendChild(this.piano);
  }

  bindPianoKey(el, midi) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isLocalSeat()) return;
      el.setPointerCapture?.(e.pointerId);
      this.noteEvent("down", midi, { broadcast: true });
    });
    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isLocalSeat()) return;
      this.noteEvent("up", midi, { broadcast: true });
    });
    el.addEventListener("pointercancel", () => {
      if (!this.isLocalSeat()) return;
      this.noteEvent("up", midi, { broadcast: true });
    });
    el.addEventListener("pointerleave", (e) => {
      if (e.buttons === 0) return;
      if (!this.isLocalSeat()) return;
      this.noteEvent("up", midi, { broadcast: true });
    });
  }

  setPianoPressed(midi, on) {
    let el = this.pianoKeyEls[midi];
    if (!el) return;
    if (on) el.classList.add("pressed");
    else el.classList.remove("pressed");
  }

  noteEvent(type, midiNote, opts) {
    if (midiNote == null) return;
    let broadcast = opts && opts.broadcast;
    let updateUi = !opts || opts.updateUi !== false;
    if (broadcast) {
      this.app.broadcastLocalInput("polyphonicKeyboard", {
        event: type,
        midiNote,
      });
    }
    if (updateUi) {
      if (type == "down") {
        if (this.pressedMidi.has(midiNote)) return;
        this.pressedMidi.add(midiNote);
      } else {
        if (!this.pressedMidi.has(midiNote)) return;
        this.pressedMidi.delete(midiNote);
      }
      this.setPianoPressed(midiNote, type == "down");
    }
    this.sendKey(type, midiNote);
  }

  putEvents() {
    this.bindedKeyUp = this.onKeyUp.bind(this);
    this.bindedKeyDown = this.onKeyDown.bind(this);
    window.addEventListener("keydown", this.bindedKeyDown, false);
    window.addEventListener("keyup", this.bindedKeyUp, false);
  }

  resolveMidi(e) {
    let k = e.key;
    if (k.length === 1) k = k.toLowerCase();
    return PolyphonicKeyboard.KEY_TO_MIDI[k];
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey) return;
    if (e.repeat) return;
    let midi = this.resolveMidi(e);
    if (midi == null) return;
    this.app.broadcastLocalInput("polyphonicKeyboard", {
      event: "down",
      midiNote: midi,
    });
    if (this.isLocalSeat()) this.noteEvent("down", midi);
  }

  onKeyUp(e) {
    if (e.ctrlKey || e.metaKey) return;
    let midi = this.resolveMidi(e);
    if (midi == null) return;
    this.app.broadcastLocalInput("polyphonicKeyboard", {
      event: "up",
      midiNote: midi,
    });
    if (this.isLocalSeat()) this.noteEvent("up", midi);
  }

  sendKey(type, midiNote) {
    if (this.node) this.node.port.postMessage({ type, midiNote });
  }

  releaseAllKeys() {
    if (this.node) this.node.port.postMessage({ type: "releaseAll" });
    for (let midi of [...this.pressedMidi]) {
      this.setPianoPressed(midi, false);
    }
    this.pressedMidi.clear();
    for (let i = 0; i < this.outputLabels.length; i++) {
      this.setOutputActive(i, false);
    }
  }

  onRemoteInput(msg) {
    if (!msg || msg.device != "polyphonicKeyboard") return;
    if (msg.userID != this.sourceUserID) return;
    if (this.isLocalSeat()) return;
    if (msg.event != "down" && msg.event != "up") return;
    if (msg.midiNote == null) return;
    if (msg.event == "down") {
      this.pressedMidi.add(msg.midiNote);
      this.setPianoPressed(msg.midiNote, true);
    } else {
      this.pressedMidi.delete(msg.midiNote);
      this.setPianoPressed(msg.midiNote, false);
    }
    this.sendKey(msg.event, msg.midiNote);
  }

  onSeatChanged(prev, next) {
    if (prev == this.app.userID && next != this.app.userID) {
      this.releaseAllKeys();
    }
  }

  updateUI() {
    this.refreshSeatSelect();
  }

  createNode() {
    this.app
      .loadWorklet("js/audioWorklets/polyphonicKeyboardWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(
          this.app.actx,
          "polyphonic-keyboard-worklet",
          {
            numberOfInputs: 0,
            numberOfOutputs: 8,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          if (e.data && e.data.type == "freqs") {
            let freqs = e.data.freqs || [];
            for (let i = 0; i < 8; i++) {
              this.setOutputActive(i, (freqs[i] || 0) > 0);
            }
          }
        };
      });
  }

  remove() {
    window.removeEventListener("keydown", this.bindedKeyDown, false);
    window.removeEventListener("keyup", this.bindedKeyUp, false);
    super.remove();
  }
}
