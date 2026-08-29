class ImageMaker extends Component {
  static name = "Image Maker";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.width = 215;
    this.height = 121;
    this.infoText =
      "This modules has 4 inputs: R, G, B, A, or Red, Green, Blue and Alpha. The canvas we have in this module is 217 by 123 pixels. Which totals 26691 pixels. Digital sound signals have 48000 values/samples per second (audio pixels if you will)";
    this.totalPixels = this.height * this.width;

    this.createCanvas();
    this.createNode();
    this.createButtonToToggleFullscreen();
    this.lastImageProcessed = 0;

    this.loop();
    this.counter = 0;
    this.numOfFramesToFade = 5;
  }

  createButtonToToggleFullscreen() {
    this.toggle = document.createElement("button");
    this.toggle.classList.add("togglefullscreen");
    this.toggle.innerHTML = "Toggle Fullscreen";
    this.toggle.onclick = () => {
      if (this.canvas.parentNode == this.app.container) {
        (this.main || this.container).append(this.canvas);
      } else {
        this.app.container.append(this.canvas);
      }
    };
    (this.main || this.container).appendChild(this.toggle);
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.willReadFrequently = true;
    this.canvas.classList.add("imgMakerCanvas");

    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.tempCanvas1 = document.createElement("canvas");
    this.tempCanvas1.width = this.width;
    this.tempCanvas1.height = this.height;
    this.tempCanvas1.willReadFrequently = true;
    this.tempCtx1 = this.tempCanvas1.getContext("2d");
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/imageMakerAudioWorklet.js")
      .then(() => {
        this.createdAt = this.app.actx.currentTime;
        this.node = this.makeWorklet("image-maker-worklet", {
          numberOfInputs: 4,
          numberOfOutputs: 0,
          bulkBytes: this.width * this.height * 4,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
      });
  }
  onSabTick() {
    super.onSabTick();
    let bulk = this.sabBulk;
    if (!bulk) return;
    let seq = bulk.seq();
    if (seq === this._bulkSeq) return;
    this._bulkSeq = seq;
    let n = this.totalPixels * 4;
    if (!this._pixels) {
      this._pixels = new Uint8ClampedArray(n);
      this.imgData = new ImageData(this._pixels, this.width, this.height);
    }
    let off = bulk.bufOffset(bulk.which());
    this._pixels.set(bulk.u8.subarray(off, off + n));
    this.deltaTime = this.app.actx.currentTime - this.lastImageProcessed;
    this.lastImageProcessed = this.app.actx.currentTime;
    this.fadeImages();
  }

  fadeImages() {
    if (!this.ctx || isNaN(this.deltaTime)) return;

    this.tempCtx1.putImageData(this.imgData, 0, 0);
    this.numOfFramesToFade = this.counter;
    this.counter = 0;
  }

  loop() {
    if (this.imgData && this.deltaTime && this.ready) {
      this.counter++;
      this.ctx.globalAlpha = 1 / this.numOfFramesToFade;
      this.ctx.drawImage(
        this.tempCanvas1,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }

    requestAnimationFrame((e) => this.loop(e));
  }
}
