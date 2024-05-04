class ImagePlayerWorkletVersion extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createInputFile();

    this.createNode();
    this.imageDataParsed = [{ r: 0, g: 0, b: 0 }];
    this.valuesToSave = ["base64", "filename"];
  }

  createInputFile() {
    this.img = document.createElement("img");
    this.img.onload = (e) => this.handleImgOnLoad(e);
    this.canvas = document.createElement("canvas");
    this.canvas.willReadFrequently = true;

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    this.container.appendChild(this.inputFile);
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
      };
      reader.readAsArrayBuffer(file);
    } else if ((this.serializedData || {}).base64) {
      this.img.src = "data:image/png;base64,"+this.serializedData.base64;
    }
  }

  handleImgOnLoad() {
    this.canvas.width = this.img.naturalWidth;
    this.canvas.height = this.img.naturalHeight;
    this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.imageDataParsed = [];
    // debugger;
    for (let i = 0; i < this.imageData.data.length / 4; i++) {
      let idx = i * 4;
      this.imageDataParsed.push({
        r: this.imageData.data[idx],
        g: this.imageData.data[idx + 1],
        b: this.imageData.data[idx + 2],
        a: this.imageData.data[idx + 3],
      });
    }

    // this.createAudioBuffers();
    this.sendImgDataToWorklet();
  }

  sendImgDataToWorklet() {
    console.log("#sending data to worklet");
    this.node.port.postMessage(this.imageDataParsed);
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/imagePlayerAudioWorklet.js")
      .then(() => {
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

        this.node.port.onmessage = (e) => this.handleDataFromWorklet(e);

        // this.createInputButtons();
      });
  }
  handleDataFromWorklet(e) {
    console.log("data q viene del worklet", e.data);
    // debugger
  }

  async updateUI() {
    //THIS METHOD IS EXECUTED FROM THE COMPONENT CLASS, WHEN THIS COMPONENT ALREADY LOADED THE SAVED DATA

    if (this.base64) {
      // base64ToArrayBuffer(this.base64)

      this.handleOnChange();
    }
  }
}
