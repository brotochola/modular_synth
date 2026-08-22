class MidiFilePlayer extends Component {
  static name = "MIDI Player";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.outputValue = 0;
    this.playing = false;

    this.createInputFile();
    this.createPlayButton();

    this.currentValue = 0;

    this.midiPlayer = new MidiPlayer.Player(() => {});
    this.midiPlayer.on("midiEvent", (e) => this.handleMidiEvent(e));
    this.createNode();
    this.valuesToSave = ["audioEncoding", "base64", "filename"];
    this.outputLabels = ["note", "trigger"];

    this.customAudioTriggers = ["trigger"];
  }
  handleMidiEvent(e) {
    this.outputValue = 0;
    if (e.name == "Note on") {
      this.outputValue = this.noteToFreq(e.noteNumber);
      this.updateNodeWithcurrentValue();
    }
  }
  createPlayButton() {
    this.playButton = document.createElement("button");
    this.playButton.style.display = "none";
    this.playButton.classList.add("playButton");

    (this.main || this.container).appendChild(this.playButton);

    this.playButton.onclick = () => {
      this.playPause();
    };
  }
  handleTriggerFromWorklet(e) {
    if (e.current != 0) this.playPause();
  }
  noteToFreq(note) {
    let a = 440;
    return (a / 32) * 2 ** ((note - 9) / 12);
  }

  playPause() {
    if (!this.arrayBuffer) return;
    this.midiPlayer.setTempo(this.app.bpm);
    if (this.playing) {
      this.playing = false;
      this.midiPlayer.stop();
      this.outputValue = 0;
      this.updateNodeWithcurrentValue();
    } else {
      this.midiPlayer.play();
      this.playing = true;
    }

    this.updateButton();
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
    this.app.loadWorklet("js/audioWorklets/midiPlayerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "midi-player-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 2,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.updateNodeWithcurrentValue();
      });
  }
  updateNodeWithcurrentValue() {
    if (!this.node?.port) return;
    this.node.port.postMessage({
      event: "note_on",
      value: Math.floor(this.outputValue),
    });
  }

  loadMidiFromBuffer(buf) {
    this.arrayBuffer = copyArrayBuffer(buf);
    this.midiPlayer.loadArrayBuffer(this.arrayBuffer);
    this.playButton.style.display = "block";
    if (this.buttonToTriggerInputFile) {
      this.buttonToTriggerInputFile.style.display = "none";
    }
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
      let gz = await gzipArrayBuffer(raw);
      this.audioEncoding = "gzip";
      this.base64 = arrayBufferToBase64(gz);
      createBase64FileInFirebase(
        this.app.patchName,
        this.base64,
        this.filename,
      );
      this.loadMidiFromBuffer(raw);
      this.quickSave();
      this.updateButton();
    };
    reader.readAsArrayBuffer(file);
    this.currentAudioFile = file;
    this.updateButton();
  }

  async updateUI() {
    if (this.base64) {
      let raw = await base64ToAudioArrayBuffer(this.base64, this.audioEncoding);
      this.loadMidiFromBuffer(raw);
      this.updateButton();
      return;
    }
    if (this.filename) {
      let dataFromFirebase = await getBase64FileFromFirebase(
        this.app.patchName,
        this.filename,
      );
      if (dataFromFirebase) {
        this.base64 = dataFromFirebase.base64;
        this.audioEncoding = dataFromFirebase.audioEncoding;
        let raw = await base64ToAudioArrayBuffer(
          this.base64,
          this.audioEncoding,
        );
        this.loadMidiFromBuffer(raw);
      }
      this.updateButton();
    }
  }
}
