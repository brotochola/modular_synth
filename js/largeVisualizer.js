class LargeVisualizer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.node = app.actx.createAnalyser();

    this.node.fftSize = 2048;

    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Float32Array(this.bufferLength);
    // this.createInputButtons();

    this.stretchFactor = 100;

    this.width = 1024;

    this.createCanvas();

    this.createInputForSpeed();

    this.draw();
  }

  createInputForSpeed() {
    this.input = document.createElement("input");
    this.input.classList.add("speed");
    this.input.type = "number";
    let audioparamrow = document.createElement("audioparamrow");

    audioparamrow.innerHTML += "<p>Speed:</p>";
    audioparamrow.appendChild(this.input);
    this.inputsDiv.appendChild(audioparamrow);

    this.input.value = this.stretchFactor;

    this.input.onchange = (e) => {
      this.stretchFactor = this.input.value;
    };
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = 128;
    this.canvas.onclick = (e) => this.toggleActive();
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "#000000";

    this.ctx.lineWidth = 0.3;
    this.ctx.strokeStyle = "#ffffff";

    this.imgData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );
  }

  draw() {
    if (!this.node || !this.ctx) return;
    requestAnimationFrame(() => this.draw());
    this.deltaTime = this.app.actx.currentTime - this.lastCall;

    // if(this.deltaTime*1000 <(this.bufferLength / this.app.actx.sampleRate) * 1000){
    //   return
    // }
    this.lastCall = this.app.actx.currentTime;

    this.node.getFloatTimeDomainData(this.dataArray);

    this.imageData = this.ctx.getImageData(
      1,
      0,
      this.canvas.width,
      this.canvas.height
    );
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.putImageData(
      this.imageData,
      -(this.dataArray.length / this.stretchFactor),
      0
    );

    this.ctx.fillStyle = "#ffffff50";


    for (let i = 0; i < this.dataArray.length; i++) {
      const y =
        this.canvas.height -
        (this.dataArray[i] * this.canvas.height * 0.5 +
          this.canvas.height * 0.5);
      // const y = v * (this.canvas.height / 2);
      let x =
        this.canvas.width -
        this.dataArray.length / this.stretchFactor +
        i / this.stretchFactor -
        1;

      // if (this.lastX < x) {
      // this.ctx.moveTo(x, y);
      // this.ctx.lineTo(this.lastX, this.lastY);
      // }

      this.ctx.fillRect(x, y, 0.3, 0.5);
      // this.ctx.fillRect((x + this.lastX) * 0.5, (y + this.lastY) * 0.5, 0.1, 0.5);

      this.lastX = x;
      this.lastY = y;
    }
    // this.ctx.stroke();
    // this.ctx.beginPath();
    // setTimeout(
    //   () => this.draw(),
    //   (this.bufferLength / this.app.actx.sampleRate) * 1000
    // );
  }
}
