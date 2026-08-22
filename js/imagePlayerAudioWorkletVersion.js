class ImagePlayerWorkletVersion extends Component {
  static name = "Image Player";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Image player. Load a still image and stream its R, G, B, A channels as audio-rate outputs. Filename is saved with the patch. Pair with Image Maker or math modules.";

    this.createInputFile();

    this.createNode();
    this.valuesToSave = ["filename"];
    this.outputLabels = ["R", "G", "B", "A"];
  }

  createInputFile() {
    this.img = document.createElement("img");
    this.img.onload = (e) => this.handleImgOnLoad(e);
    this.canvas = document.createElement("canvas");
    this.canvas.willReadFrequently = true;

    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    (this.main || this.container).appendChild(this.inputFile);

    this.buttonToTriggerInputFile = document.createElement("button");
    this.buttonToTriggerInputFile.innerHTML = "Choose file...";
    this.buttonToTriggerInputFile.classList.add("triggerInputFile");
    this.buttonToTriggerInputFile.onclick = () => this.inputFile.click();
    (this.main || this.container).appendChild(this.buttonToTriggerInputFile);
  }
  makeButtonInvisible() {
    this.buttonToTriggerInputFile.style.display = "none";
  }

  handleOnChange(e) {
    try {
      this.node.stop();
    } catch (e) {}
    let file = this.inputFile.files[0];

    if (file) {
      this.img.src = URL.createObjectURL(file);
      let reader = new FileReader();
      reader.onload = async () => {
        this.base64 = arrayBufferToBase64(reader.result);
        this.filename = file.name;
        this.makeButtonInvisible();
        createBase64FileInFirebase(
          this.app.patchName,
          this.base64,
          this.filename
        );
        this.quickSave();
      };
      reader.readAsArrayBuffer(file);
    } else if (this.base64) {
      this.makeButtonInvisible();
      this.img.src = "data:image/png;base64," + this.base64;
    }
  }

  handleImgOnLoad() {
    this.canvas.width = 215;
    this.canvas.height = 121;
    this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.sendImgDataToWorklet();
  }

  sendImgDataToWorklet() {
    if (!this.node || !this.imageData) return;
    let buf = new Uint8Array(this.imageData.data);
    this.node.port.postMessage(buf, [buf.buffer]);
  }
  createNode() {
    this.app.loadWorklet("js/audioWorklets/imagePlayerAudioWorklet.js")
      .then(() => {
        this.createdAt = this.app.actx.currentTime;
        this.node = new AudioWorkletNode(
          this.app.actx,
          "image-player-worklet",
          {
            numberOfInputs: 0,
            numberOfOutputs: 4,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.sendImgDataToWorklet();
      });
  }

  async updateUI() {
    if (this.filename && !this.base64) {
      this.base64 = (
        await getBase64FileFromFirebase(this.app.patchName, this.filename)
      ).base64;
    }

    if (this.base64) {
      this.handleOnChange();
    }
  }
}
