class Spectrum2Image extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = app.actx.createAnalyser();
    this.ready = true;

    this.node.fftSize = 32768;

    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.createCanvas();
    // this.img = new Image();
    // this.container.appendChild(this.img);
    this.running = true;
    this.pixIndex = 0;
    this.runloop();
  }
  makeImage() {
 

    if (!this.dataArray || !this.canvas) return;

    for (let i = 0; i < this.dataArray.length; i++) {
      let idx = this.pixIndex + i;
      // if(idx%4==2) continue
      this.imgData.data[idx] = this.dataArray[i] || 0;

    }

    this.pixIndex += this.dataArray.length;
    if (this.pixIndex > this.canvas.width * this.canvas.height * 4) {
      this.ctx.putImageData(this.imgData, 0, 0);
      this.pixIndex = 0;
      this.imgData = this.ctx.createImageData(
        this.canvas.width,
        this.canvas.height
      );
    }

  }

 
  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.willReadFrequently = true;
    this.canvas.width = 512;
    this.canvas.height = this.canvas.width / 1.77777;
    this.ctx = this.canvas.getContext("2d");
    this.container.appendChild(this.canvas);

    this.imgData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );
    // this.tempCanvas = document.createElement("canvas");
    // this.tempCanvas.willReadFrequently = true;
    // this.tempCanvas.width = 240;
    // this.tempCanvas.height = 136;
    // this.tempCtx = this.tempCanvas.getContext("2d");
  }

  runloop() {
    if (!this.running) return;
    this.node.getByteFrequencyData(this.dataArray);

    // for(let i=0; i<this.dataArray.length; i++) {
    //   this.val=this.dataArray[i];
    // }

    this.makeImage();
    requestAnimationFrame(() => this.runloop());
  }
}
