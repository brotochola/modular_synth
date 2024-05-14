class AudioPlayer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.playing = false;
    this.node = this.app.actx.createBufferSource();
    this.createInputFile();
    this.createPlayButton();
    //THIS PARAMS ARE ADDED AS AN INPUT, WITH NO INPUT TEXT
    this.customAudioTriggers = ["trigger"];
    this.customAudioParams = ["offset"];
    this.valuesToSave = ["base64", "filename"];
    this.offset = 0;

    this.infoText =
      "Load an audio file and play it, either manually with the play button, or by triggering it with an input. Also you can choose when exactly the audio file will start playing (the offset), and the playback rate";
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

  handleCustomAudioParamChanged(e) {
    //CUSTOM AUDIO PARAMS CAN BE WHATEVER VALUE

    if (e.current) this.offset = e.current;
    if (this.offset > this.audioBuffer.duration) {
      this.offset = this.audioBuffer.duration;
    }
    if (this.offset < 0) this.offset = 0;

    //SET THE OFFSET AND TRIGGER THE AUDIO
    this.handleTriggerFromWorklet(e);
  }

  handleTriggerFromWorklet(e) {
    //TRIGGER ONLY CHECKS 1 OR 0
    if (e.current != 0) this.triggerAudio();
  }

  triggerAudio() {
    if (this.node && this.audioBuffer) {
      this.handleOnChange();
      this.node.start(0, this.offset);
    }
  }

  playPause() {
    if (this.playing) {
      this.playing = false;
      this.handleOnChange();
    } else {
      this.playing = true;
      this.node.start(this.app.getNextBeat());
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

  handleOnChange() {
    if (!(this.inputFile.files || [])[0] && !this.audioBuffer) {
      return console.warn("no file selected or no audio buffer loaded");
    }
    this.playButton.style.display = "block";
    this.playing = false;
    try {
      this.node.stop();
    } catch (e) {}

    if (this.node) this.node.disconnect();

    //CREATE THE AUDIO BUFFER SOURCE OBJECT
    this.node = this.app.actx.createBufferSource();
    this.node.loop = false;

    //IF THE AUDIOBUFFER IS ALREADY LOADED AND DECODED, WE USE THAT
    if (this.audioBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.node.buffer = this.audioBuffer;
      this.app.resetAllConnections();
    } else {
      //IF NOT WE GOTTA LOAD THE AUDIO FILE
      let reader = new FileReader();
      reader.onload = async () => {
        // console.log(reader.result);
        this.base64 = arrayBufferToBase64(reader.result);
        this.filename = this.inputFile.files[0].name;
        this.arrayBuffer = copyArrayBuffer(reader.result);
        this.audioBuffer = await this.app.actx.decodeAudioData(reader.result);
        this.node.buffer = this.audioBuffer;
        this.quickSave();
        this.app.resetAllConnections();
        this.updateButton();
      };

      reader.readAsArrayBuffer(this.inputFile.files[0]);
    }
    this.currentAudioFile = this.inputFile.files[0];

    this.updateButton();
  }
  async updateUI() {
    //THIS METHOD IS EXECUTED FROM THE COMPONENT CLASS, WHEN THIS COMPONENT ALREADY LOADED THE SAVED DATA

    if (this.base64) {
      this.audioBuffer = await this.app.actx.decodeAudioData(
        base64ToArrayBuffer(this.base64)
      );
      this.handleOnChange();
    }

    this.updateButton();
  }
}
