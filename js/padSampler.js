class PadSampler extends Component {
  static name = "Pad Sampler";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createNode();
    this.createInputFile();
    this.createPlayButton();
    this.valuesToSave = ["filename"];
  }
  createPlayButton() {
    this.playButton = document.createElement("button");
    this.playButton.style.display = "none";
    this.playButton.classList.add("playButton");

    (this.main || this.container).appendChild(this.playButton);

  
  }



  playWorklet() {
    this.node.port.postMessage({ action: "play" });
  }

  updateButton() {
    this.playButton.textContent = this.filename;
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/padSamplerWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "pad-sampler", {
          numberOfInputs: 8,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          // console.log("#pitch det 2", e.data.input);
          if (e.data.error) {
            console.warn("error in pitch 2", e.data.error);
          }
          if (e.data.input) {
            if (this.audioBuffer) {
              //   this.samplesFromAudioBuffer = this.audioBuffer.getChannelData(0);

              this.samplesFromAudioBuffer.set(e.data.input);
            }
          }
        };
      });
  }

  createInputFile() {
    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.accept = "audio/*";
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    (this.main || this.container).appendChild(this.inputFile);

    this.buttonToTriggerInputFile = document.createElement("button");
    this.buttonToTriggerInputFile.innerHTML = "Choose file...";
    this.buttonToTriggerInputFile.classList.add("triggerInputFile");
    this.buttonToTriggerInputFile.onclick = () => this.inputFile.click();
    (this.main || this.container).appendChild(this.buttonToTriggerInputFile);
  }

  handleOnChange() {
    if (!(this.inputFile.files || [])[0] && !this.audioBuffer) {
      return console.warn("no file selected or no audio buffer loaded");
    }
    this.playButton.style.display = "block";
    this.buttonToTriggerInputFile.style.display = "none";

    //IF THE AUDIOBUFFER IS ALREADY LOADED AND DECODED, WE USE THAT
    if (this.audioBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.sendToWorklet();
      this.haveISavedTheBase64File = true;
      this.app.resetAllConnections();
    } else {
      //IF NOT WE GOTTA LOAD THE AUDIO FILE
      let reader = new FileReader();
      reader.onload = async () => {
        this.filename = this.inputFile.files[0].name;
        let saved = await saveBinaryAsset(
          this.app.patchName,
          this.filename,
          reader.result,
          { gzip: false },
        );
        this.base64 = saved.base64;
        this.audioEncoding = saved.audioEncoding;
        this.arrayBuffer = copyArrayBuffer(reader.result);
        this.audioBuffer = await this.app.actx.decodeAudioData(
          copyArrayBuffer(reader.result),
        );
        this.sendToWorklet();
        this.quickSave();
        this.app.resetAllConnections();
        this.updateButton();
      };

      reader.readAsArrayBuffer(this.inputFile.files[0]);
    }
    this.currentAudioFile = this.inputFile.files[0];

    this.updateButton();
  }

  sendToWorklet() {
    if (this.audioBuffer) {
      this.node.port.postMessage({
        audioBuffer: this.audioBuffer.getChannelData(0),
      });
    }
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
      this.audioBuffer = await this.app.actx.decodeAudioData(
        copyArrayBuffer(loaded.arrayBuffer),
      );
      this.handleOnChange();
    }
    this.updateButton();
  }
}
