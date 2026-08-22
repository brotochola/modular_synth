class WebcamPlayer extends Component {
  static name = "Webcam";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Webcam → audio. Streams live camera frames as R, G, B audio-rate outputs (pixel streams). Patch into Image Maker, Shader, Custom Processor, etc.";

    this.createCanvas();

    this.createNode();
    this.outputLabels = ["R", "G", "B"];
    this.loop = true;
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

    (this.main || this.container).appendChild(this.canvas);

    this.canvas.width = 215;
    this.canvas.height = 121;
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

    this.sendImgDataToWorklet();
    if (this.loop) requestAnimationFrame(() => this.runLoop());
  }

  sendImgDataToWorklet() {
    if (!this.node || !this.imageData) return;
    let buf = new Uint8Array(this.imageData.data);
    this.node.port.postMessage(buf, [buf.buffer]);
  }
  createNode() {
    this.app.loadWorklet("js/audioWorklets/webcamPlayerWorklet.js")
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
      });
  }

  async updateUI() {}
}
