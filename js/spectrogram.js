class Spectrogram extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = app.actx.createAnalyser();
    this.createCanvas();
    this.node.fftSize = 256;

    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.barWidth = 1;
    this.barHeight = this.canvas.height / this.node.fftSize;
    // this.createInputButtons();

    this.draw();
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 180;
    this.canvas.height = 70;
    this.canvas.onclick = (e) => this.toggleActive();
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  draw() {
    if (!this.node) return;
    this.node.getByteFrequencyData(this.dataArray);
    var imageData = this.ctx.getImageData(
      1,
      0,
      this.canvas.width - this.barWidth,
      this.canvas.height
    );
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.putImageData(imageData, -this.barWidth, 0);

    for (let i = 0; i < this.node.fftSize; i++) {
      let val = this.dataArray[i];
      this.ctx.fillStyle = "rgb(" + val + "," + val + "," + val + ")";
      this.ctx.fillRect(
        this.canvas.width - this.barWidth,
        (this.canvas.height - (i * 1.8*this.barHeight))-this.barHeight,
        this.barWidth,
        this.barHeight
      );
    }

    // canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    requestAnimationFrame(() => this.draw());
  }
}
