class WebcamPlayer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.createCanvas();

    this.createNode();
    this.imageDataParsed = [{ r: 0, g: 0, b: 0 }];
    this.outputLabels = ["R", "G", "B"];
    this.loop=true
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    navigator.getUserMedia(
      { video: true, audio: false },
      (stream) => this.handleWebcamReady(stream),
      console.warn
    );
  }

  handleWebcamReady(stream) {
    this.videoElement.srcObject = stream;
    this.videoElement.addEventListener("loadedmetadata", () => {
      this.videoElement.play();
    });

    this.runLoop();
  }

  createCanvas() {
    this.videoElement = document.createElement("video");

    this.canvas = document.createElement("canvas");
    this.canvas.willReadFrequently = true;

    this.container.appendChild(this.canvas);

    this.canvas.width = 215; //this.img.naturalWidth;
    this.canvas.height = 121; //this.img.naturalHeight;
    this.ctx = this.canvas.getContext("2d");
  }

  runLoop() {
    this.ctx.drawImage(
      this.videoElement,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
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
    if (this.loop) requestAnimationFrame(() => this.runLoop());
  }

  sendImgDataToWorklet() {
    // console.log("#sending data to webcam worklet");
    this.node.port.postMessage(this.imageDataParsed);
  }
  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/webcamPlayerWorklet.js")
      .then(() => {
        this.createdAt = this.app.actx.currentTime;
        this.node = new AudioWorkletNode(
          this.app.actx,
          "webcam-player-worklet",
          {
            numberOfInputs: 0,
            numberOfOutputs: 3,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => this.handleDataFromWorklet(e);

        // this.createInputButtons();
      });
  }
  handleDataFromWorklet(e) {}

  async updateUI() {
    //THIS METHOD IS EXECUTED FROM THE COMPONENT CLASS, WHEN THIS COMPONENT ALREADY LOADED THE SAVED DATA
  }
}
