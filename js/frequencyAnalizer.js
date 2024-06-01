class FrequencyAnalizer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = app.actx.createAnalyser();

    this.node.fftSize = 1024;

    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    // this.createInputButtons();
    this.createCanvas();
    this.draw();
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 180;
    this.canvas.height = 70;
    this.canvas.onclick = (e) => this.toggleActive();
    this.container.appendChild(this.canvas);
  }

  draw() {
    if (!this.node) return;
    this.node.getByteFrequencyData(this.dataArray);
    const canvasCtx = this.canvas.getContext("2d");
    canvasCtx.fillStyle = "#000000";
    canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Draw visualization
    const barWidth = (this.canvas.width / this.bufferLength) * 0.5;
    let x = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const barHeight = this.dataArray[i] / 4;
      canvasCtx.fillStyle = "rgb(" + (barHeight * 4 + 100) + ",100,0)";
      canvasCtx.fillRect(
        // toLog(x * (48000 / this.node.fftSize), 10, 20000),
        x,
        this.canvas.height - barHeight,
        barWidth,
        barHeight
      );
      x += this.canvas.width / this.bufferLength;
    }

    // canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    requestAnimationFrame(() => this.draw());
  }
}
