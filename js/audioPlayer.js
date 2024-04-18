class AudioPlayer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.playing = false;
    this.node = this.app.actx.createBufferSource();
    this.createInputFile();
    this.createPlayButton();
    //THIS PARAMS ARE ADDED AS AN INPUT, WITH NO INPUT TEXT
    this.customAudioParams = ["trigger"];
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
    // console.log("#handleTriggerFromWorklet",e)
    this.triggerAudio();
  }

  triggerAudio() {
    if (this.node && this.currentAudioFile) {
      this.handleOnChange();
      this.node.loop = false;
      this.node.start(this.app.getNextBeat());
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
  handleOnChange(e) {
    if (!(this.inputFile.files || [])[0]) {
      return;
    }
    this.playButton.style.display = "block";
    this.playing = false;
    try {
      this.node.stop();
    } catch (e) {}

    if (this.node) this.node.disconnect();

    //CREATE THE AUDIO BUFFER SOURCE OBJECT
    this.node = this.app.actx.createBufferSource();

    //IF THE AUDIOBUFFER IS ALREADY LOADED AND DECODED, WE USE THAT
    if (this.audioBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.node.buffer = this.audioBuffer;
      this.node.loop = true;
      this.app.resetAllConnections();
    } else {
      //IF NOT WE GOTTA LOAD THE AUDIO FILE
      let reader = new FileReader();
      reader.onload = async () => {
        // console.log(reader.result);
        this.arrayBuffer = copyArrayBuffer(reader.result)
        this.audioBuffer = await this.app.actx.decodeAudioData(reader.result);
        this.node.buffer = this.audioBuffer;
        this.node.loop = true;
        this.app.resetAllConnections();
      };

      reader.readAsArrayBuffer(this.inputFile.files[0]);
    }
    this.currentAudioFile = this.inputFile.files[0];
    this.updateButton();
  }
}
