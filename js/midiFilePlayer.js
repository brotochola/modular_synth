class MidiFilePlayer extends Component {
  static name = "MIDI Player";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "MIDI file player. Load a .mid file, then play with the button or a rising trigger; stop input ends playback. Outputs note frequency (Hz) and a trigger pulse per note. Rate scales tempo (0.25–4×). File is saved with the patch.";
    this.playing = false;
    this.namedAudioInputs = ["trigger", "stop"];
    this.uiParamWidgets = { in_0: "none", in_1: "none" };
    this.valuesToSave = ["audioEncoding", "base64", "filename"];
    this.outputLabels = ["note", "trigger"];

    this.createInputFile();
    this.createPlayButton();
    this.createNode();
  }

  createPlayButton() {
    this.playButton = document.createElement("button");
    this.playButton.style.display = "none";
    this.playButton.classList.add("playButton");
    (this.main || this.container).appendChild(this.playButton);
    this.playButton.onclick = () => this.playPause();
  }

  noteToFreq(note) {
    return (440 / 32) * 2 ** ((note - 9) / 12);
  }

  flattenMidiEvents(player) {
    let flat = [];
    let tracks = player.getEvents() || [];
    for (let track of tracks) {
      for (let ev of track) {
        if (ev.name == "Note on" && ev.velocity > 0) {
          flat.push({ tick: ev.tick || 0, type: 1, note: ev.noteNumber });
        } else if (
          ev.name == "Note off" ||
          (ev.name == "Note on" && !(ev.velocity > 0))
        ) {
          flat.push({ tick: ev.tick || 0, type: 0, note: ev.noteNumber });
        }
      }
    }
    flat.sort((a, b) => a.tick - b.tick || a.type - b.type);
    return flat;
  }

  postLoadToWorklet() {
    if (!this.node?.port || !this.arrayBuffer) return;
    let player = new MidiPlayer.Player(() => {});
    player.loadArrayBuffer(this.arrayBuffer);
    let events = this.flattenMidiEvents(player);
    this.ppqn = player.division || 480;
    this.node.port.postMessage({
      type: "load",
      events,
      ppqn: this.ppqn,
      bpm: this.app.bpm || 120,
    });
  }

  play() {
    if (!this.arrayBuffer || !this.node?.port) return;
    this.node.port.postMessage({ type: "play" });
    this.playing = true;
    this.updateButton();
  }

  stop() {
    if (!this.node?.port) return;
    this.node.port.postMessage({ type: "stop" });
    this.playing = false;
    this.updateButton();
  }

  playPause() {
    if (!this.arrayBuffer) return;
    if (this.playing) this.stop();
    else this.play();
  }

  updateBPM() {
    if (!this.node?.port) return;
    this.node.port.postMessage({ type: "setBpm", bpm: this.app.bpm || 120 });
  }

  updateButton() {
    let name = this.filename || "MIDI";
    this.playButton.textContent = !this.playing ? "▶️ " + name : "⏹️ " + name;
  }

  createInputFile() {
    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.accept = ".mid,.midi,audio/midi,audio/x-midi";
    this.inputFile.onchange = () => this.handleOnChange();
    (this.main || this.container).appendChild(this.inputFile);

    this.buttonToTriggerInputFile = document.createElement("button");
    this.buttonToTriggerInputFile.innerHTML = "Choose file...";
    this.buttonToTriggerInputFile.classList.add("triggerInputFile");
    this.buttonToTriggerInputFile.onclick = () => this.inputFile.click();
    (this.main || this.container).appendChild(this.buttonToTriggerInputFile);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/midiPlayerWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "midi-player-worklet", {
        numberOfInputs: 2,
        numberOfOutputs: 2,
        parameterData: { rate: 1 },
      });
      this.node.onprocessorerror = (e) => console.error(e);
      this.node.port.onmessage = (e) => {
        if (e.data && e.data.ended) {
          this.playing = false;
          this.updateButton();
        }
      };
      if (this.arrayBuffer) this.postLoadToWorklet();
    });
  }

  loadMidiFromBuffer(buf) {
    this.arrayBuffer = copyArrayBuffer(buf);
    this.playing = false;
    this.playButton.style.display = "block";
    if (this.buttonToTriggerInputFile) {
      this.buttonToTriggerInputFile.style.display = "none";
    }
    this.postLoadToWorklet();
    this.app.resetAllConnections();
    this.updateButton();
  }

  handleOnChange() {
    if (!(this.inputFile.files || [])[0] && !this.arrayBuffer) {
      return console.warn("no file selected or no midi buffer loaded");
    }
    this.playing = false;
    this.playButton.style.display = "block";
    if (this.buttonToTriggerInputFile) {
      this.buttonToTriggerInputFile.style.display = "none";
    }

    if (this.arrayBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.loadMidiFromBuffer(this.arrayBuffer);
      return;
    }

    if (!(this.inputFile.files || [])[0]) {
      if (this.arrayBuffer) this.loadMidiFromBuffer(this.arrayBuffer);
      return;
    }

    let file = this.inputFile.files[0];
    let reader = new FileReader();
    reader.onload = async () => {
      let raw = reader.result;
      this.filename = file.name;
      let saved = await saveBinaryAsset(
        this.app.patchName,
        this.filename,
        raw,
        { gzip: true },
      );
      this.base64 = saved.base64;
      this.audioEncoding = saved.audioEncoding;
      this.loadMidiFromBuffer(raw);
      this.quickSave();
      this.updateButton();
    };
    reader.readAsArrayBuffer(file);
    this.currentAudioFile = file;
    this.updateButton();
  }

  async updateUI() {
    let loaded = await loadBinaryAsset({
      patchName: this.app.patchName,
      filename: this.filename,
      base64: this.base64,
      audioEncoding: this.audioEncoding,
    });
    if (loaded) {
      this.base64 = loaded.base64;
      this.audioEncoding = loaded.audioEncoding;
      this.loadMidiFromBuffer(loaded.arrayBuffer);
    }
    this.updateButton();
  }
}
