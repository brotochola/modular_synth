class MidiFilePlayer extends Component {
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
    this.valuesToSave = ["base64", "filename"];
    this.outputLabels = ["note", "trigger"];

    //THIS PARAMS ARE ADDED AS AN INPUT, WITH NO INPUT TEXT
    this.customAudioTriggers = ["trigger"];
  }
  handleMidiEvent(e) {
    // if (e.track == 1) {
    console.log(e);
    this.outputValue = 0;
    if (e.name == "Note on") {
      this.outputValue = this.noteToFreq(e.noteNumber);
      this.updateNodeWithcurrentValue();
    } else if (e.name == "Note off") {
    }
    // }
  }
  createPlayButton() {
    this.playButton = document.createElement("button");
    this.playButton.style.display = "none";
    this.playButton.classList.add("playButton");

    this.container.appendChild(this.playButton);

    this.playButton.onclick = (e) => {
      this.playPause();
    };
  }
  handleTriggerFromWorklet(e) {
    console.log("#handleTriggerFromWorklet", this);
  }
  noteToFreq(note) {
    let a = 440; //frequency of A (coomon value is 440Hz)
    return (a / 32) * 2 ** ((note - 9) / 12);
  }

  playPause() {
    this.midiPlayer.setTempo(this.app.bpm);
    if (this.playing) {
      this.playing = false;
      this.midiPlayer.stop();
      this.outputValue = 0;
      this.updateNodeWithcurrentValue()
    } else {
      this.midiPlayer.play();
      this.playing = true;
    }

    this.updateButton();
  }

  updateButton() {
    this.playButton.textContent = !this.playing
      ? "▶️ " + this.filename
      : "⏹️ " + this.filename;
  }

  createInputFile() {
    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.accept = "audio/*";
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    this.container.appendChild(this.inputFile);
  }

  //   createAudioBuffer() {
  //     // Create a MediaElementAudioSourceNode
  //     // Feed the HTMLMediaElement into it
  //     this.node = this.app.actx.createMediaElementSource(this.audio);
  //
  //     this.node.loop = true;
  //     // this.node.start(0);
  //   }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/midiPlayerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "midi-player-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 2,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.updateNodeWithcurrentValue();
        this.node.port.onmessage = (e) => console.log("#msg", e.data);
      });
  }
  updateNodeWithcurrentValue() {
    if (!this.node?.port) return console.warn("no port");
    this.node.port.postMessage({
      event: "note_on",
      value: Math.floor(this.outputValue),
    });
  }
  handleOnChange(e) {
    if (!(this.inputFile.files || [])[0] && !this.arrayBuffer) {
      return;
    }
    this.playButton.style.display = "block";
    this.playing = false;
    //IF NOT WE GOTTA LOAD THE AUDIO FILE

    if (this.arrayBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.midiPlayer.loadArrayBuffer(this.arrayBuffer);
      this.app.resetAllConnections();
    } else {
      let reader = new FileReader();
      reader.onload = async () => {
        this.arrayBuffer = copyArrayBuffer(reader.result);
        this.base64 = arrayBufferToBase64(reader.result);
        this.midiPlayer.loadArrayBuffer(this.arrayBuffer);
        this.app.resetAllConnections();
      };
      this.filename = this.inputFile.files[0].name;
      reader.readAsArrayBuffer(this.inputFile.files[0]);
    }
    this.currentAudioFile = this.inputFile.files[0];
    this.updateButton();
  }
  async updateUI() {
    //THIS METHOD IS EXECUTED FROM THE COMPONENT CLASS, WHEN THIS COMPONENT ALREADY LOADED THE SAVED DATA

    if (this.base64) {
      this.arrayBuffer = base64ToArrayBuffer(this.base64);
      this.handleOnChange();
    }

    this.updateButton();
  }
}
