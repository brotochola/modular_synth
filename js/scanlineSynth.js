class ScanlineSynth extends Component {
  static name = "Scanline";
  static WIDTH = 256;
  static HEIGHT = 128;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Scanline synth. One image row becomes a wavetable; frequency is pitch, row picks which line. Load a still or turn on the webcam. Face, photo, or shader dump as oscillator.";
    this.valuesToSave = ["filename"];
    this.camOn = false;
    this.loop = false;
    this._overlay = true;
    this.createCanvas();
    this.createInputFile();
    this.createCamToggle();
    this.createNode();
    this.startOverlayLoop();
  }

  getParamInputLimits(name) {
    if (name == "frequency") return { min: 0, max: 2000, step: 0.1 };
    if (name == "row") return { min: 0, max: 1, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = ScanlineSynth.WIDTH;
    this.canvas.height = ScanlineSynth.HEIGHT;
    this.canvas.classList.add("scanlineCanvas");
    this.canvas.willReadFrequently = true;
    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.videoElement = document.createElement("video");
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.img = document.createElement("img");
    this.img.onload = () => this.handleImgOnLoad();
  }

  createInputFile() {
    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.accept = "image/*";
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    (this.main || this.container).appendChild(this.inputFile);

    this.buttonToTriggerInputFile = document.createElement("button");
    this.buttonToTriggerInputFile.innerHTML = "Choose file...";
    this.buttonToTriggerInputFile.classList.add("triggerInputFile");
    this.buttonToTriggerInputFile.onclick = () => this.inputFile.click();
    (this.main || this.container).appendChild(this.buttonToTriggerInputFile);
  }

  createCamToggle() {
    this.camButton = document.createElement("button");
    this.camButton.classList.add("triggerInputFile");
    this.camButton.innerHTML = "Webcam";
    this.camButton.onclick = (e) => {
      e.stopPropagation();
      this.toggleCam();
    };
    (this.main || this.container).appendChild(this.camButton);
  }

  toggleCam() {
    if (this.camOn) this.stopCam();
    else this.startCam();
  }

  startCam() {
    let getUserMedia =
      (navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)) ||
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;
    if (!getUserMedia) return console.warn("no camera");
    let req =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : new Promise((res, rej) =>
            getUserMedia.call(
              navigator,
              { video: true, audio: false },
              res,
              rej,
            ),
          );
    req
      .then((stream) => {
        this.camStream = stream;
        this.videoElement.srcObject = stream;
        this.videoElement.play();
        this.camOn = true;
        this.loop = true;
        this.camButton.innerHTML = "Stop cam";
        this.runLoop();
      })
      .catch(console.warn);
  }

  stopCam() {
    this.camOn = false;
    this.loop = false;
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null;
    }
    this.videoElement.srcObject = null;
    if (this.camButton) this.camButton.innerHTML = "Webcam";
  }

  handleOnChange(e) {
    let file = this.inputFile && this.inputFile.files && this.inputFile.files[0];
    if (file) {
      this.img.src = URL.createObjectURL(file);
      let reader = new FileReader();
      reader.onload = async () => {
        this.base64 = arrayBufferToBase64(reader.result);
        this.filename = file.name;
        if (this.buttonToTriggerInputFile)
          this.buttonToTriggerInputFile.style.display = "none";
        createBase64FileInFirebase(
          this.app.patchName,
          this.base64,
          this.filename,
        );
        this.quickSave();
      };
      reader.readAsArrayBuffer(file);
    } else if (this.base64) {
      if (this.buttonToTriggerInputFile)
        this.buttonToTriggerInputFile.style.display = "none";
      this.img.src = "data:image/png;base64," + this.base64;
    }
  }

  handleImgOnLoad() {
    if (this.camOn) return;
    this.ctx.drawImage(
      this.img,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.extractAndSend();
    this.drawRowLine();
  }

  startOverlayLoop() {
    let tick = () => {
      if (!this._overlay) return;
      if (!this.camOn && this.img && this.img.naturalWidth) {
        this.ctx.drawImage(
          this.img,
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
        this.drawRowLine();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  runLoop() {
    if (!this.loop) return;
    if (this.camOn && this.videoElement.readyState >= 2) {
      this.ctx.drawImage(
        this.videoElement,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      this.extractAndSend();
      this.drawRowLine();
    }
    requestAnimationFrame(() => this.runLoop());
  }

  extractAndSend() {
    let w = this.canvas.width;
    let h = this.canvas.height;
    let data = this.ctx.getImageData(0, 0, w, h).data;
    let luma = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let idx = i * 4;
      luma[i] =
        (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) /
        255;
    }
    this.luma = luma;
    if (this.node) {
      this.node.port.postMessage({ width: w, height: h, luma: luma });
    }
  }

  drawRowLine() {
    if (!this.ctx) return;
    let row = 0.5;
    if (this.node && this.node.parameters) {
      let p = this.node.parameters.get("row");
      if (p) row = p.value;
    }
    let y = Math.floor(row * (this.canvas.height - 1)) + 0.5;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255,255,255,0.85)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.canvas.width, y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/scanlineWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "scanline-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: { frequency: 110, row: 0.5 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      if (this.luma) {
        this.node.port.postMessage({
          width: this.canvas.width,
          height: this.canvas.height,
          luma: this.luma,
        });
      }
    });
  }

  async updateUI() {
    if (this.filename && !this.base64) {
      let data = await getBase64FileFromFirebase(
        this.app.patchName,
        this.filename,
      );
      this.base64 = data && data.base64;
    }
    if (this.base64) this.handleOnChange();
  }

  remove() {
    this._overlay = false;
    this.stopCam();
    super.remove();
  }
}
