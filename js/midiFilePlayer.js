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

    //THIS PARAMS ARE ADDED AS AN INPUT, WITH NO INPUT TEXT
    this.customAudioParams = ["trigger"];
  }
  handleMidiEvent(e) {
    // if (e.track == 1) {
    this.outputValue = 0;
    if (e.name == "Note on") {
      this.outputValue = this.noteToFreq(e.noteNumber);
      this.updateNodeWithcurrentValue();
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
    } else {
      this.midiPlayer.play();
      this.playing = true;
    }

    this.updateButton();
  }

  updateButton() {
    this.playButton.textContent = !this.playing ? "▶️" : "⏹️";
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
      .addModule("js/audioWorklets/customProcessor.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "custom-proc", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
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
    this.updatedcurrentValue =
      "outputChannel[i]=" + Math.floor(this.outputValue);
    this.node.port.postMessage(this.updatedcurrentValue);
  }
  handleOnChange(e) {
    if (!(this.inputFile.files || [])[0]) {
      return;
    }
    this.playButton.style.display = "block";
    this.playing = false;

    //IF NOT WE GOTTA LOAD THE AUDIO FILE
    let reader = new FileReader();
    reader.onload = async () => {
      this.arrayBuffer = copyArrayBuffer(reader.result);
      this.midiPlayer.loadArrayBuffer(this.arrayBuffer);
      this.app.resetAllConnections();
    };

    reader.readAsArrayBuffer(this.inputFile.files[0]);

    this.currentAudioFile = this.inputFile.files[0];
    this.updateButton();
  }
}
