class Visualizer extends Component {
  constructor(app) {
    super(app, "visualizer");
    this.node = app.actx.createAnalyser();
    this.node.parent = this;
    this.node.fftSize = 1024;

    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.createInputButtons(true);
    this.createCanvas();
    this.draw()
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 146;
    this.canvas.height = 70;

    this.container.appendChild(this.canvas);
  }

  draw() {
    
    this.node.getByteTimeDomainData(this.dataArray);
    const canvasCtx=this.canvas.getContext("2d");
    canvasCtx.fillStyle = "#000000";
    canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "#ffffff";
    canvasCtx.beginPath();

    const sliceWidth = this.canvas.width / this.bufferLength;
    let x = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = v * (this.canvas.height / 2);

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
    canvasCtx.stroke();

    // canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    requestAnimationFrame(() => this.draw());
  }
  // creategainKnob() {
  //   this.gainKnob = document.createElement("input");
  //   this.gainKnob.type = "number";
  //   this.gainKnob.onchange = (e) => this.onInputChange(e);
  //   this.gainKnob.max = 5;
  //   this.gainKnob.min = 0;
  //   this.gainKnob.value = "1";
  //   this.gainKnob.step = 1;
  //   ///appends
  //   this.container.appendChild(this.gainKnob);
  // }

  // onInputChange(e) {
  //   e.stopPropagation();
  //   console.log(this.gainKnob.value);
  //   this.node.gain.setValueAtTime(this.gainKnob.value, 0);
  // }

  createView() {
    // this.createConnectButton();

    // this.creategainKnob();
    makeChildrenStopPropagation(this.container);
  }
}
