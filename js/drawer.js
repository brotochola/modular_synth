class Drawer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    // this.createInputButtons();
    this.size = 256;
    this.createCanvas();
    this.createNode();
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = 100;
    this.canvas.onmousedown = (e) => {
      this.drawing = true;
      e.stopPropagation();
      e.preventDefault();
    };
    this.canvas.onmouseout = (e) => {
      this.drawing = false;
    };
    this.canvas.onmousemove = (e) => {
      this.handleDraw(e);
      e.stopPropagation();
      e.preventDefault();
    };

    this.canvas.onmouseup = (e) => {
      this.drawing = false;
    };
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.onePixelImageData = this.ctx.createImageData(1, 1);
    this.onePixelImageDataData = this.onePixelImageData.data;
  }

  createNode() {
    this.node = this.app.actx.createBufferSource();
    this.audioBuffer = this.app.actx.createBuffer(
      1,
      this.size,
      this.app.actx.sampleRate
    );

    this.node.loop = true;
    this.node.buffer = this.audioBuffer;
    this.node.start();
  }

  updateBuffer() {
    this.nowBuffering = this.audioBuffer.getChannelData(0);
    let newBuffer = this.getBufferFromPixels();
    for (let i = 0; i < this.size; i++) {
      this.nowBuffering[i] = newBuffer[i];
    }
  }
  getBufferFromPixels() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height).data;

    const result = new Array(width).fill(null);
    result[0] = 0;
    result[result.length - 1] = 0;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const index = (y * width + x) * 4;
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const a = imageData[index + 3];

        // Check if the pixel is not black
        if (r && g && b) {
          result[x] = imageValueToAudioValue(((height - y) / height) * 255);
          break;
        }
      }
    }

    return interpolateNullsCircular(result);
  }

  handleDraw(e) {
    if (this.drawing) {
        console.log(e);

      this.paintColumnBlack(e.layerX);
      this.paintColumnBlack(e.layerX - 1);
      for (let i = 0; i < this.onePixelImageDataData.length; i++) {
        this.onePixelImageDataData[i] = 255;
      }

      this.ctx.putImageData(this.onePixelImageData, e.layerX, e.layerY);
      this.ctx.putImageData(this.onePixelImageData, e.layerX - 1, e.layerY);

      //    this.ctx.strokeStyle = "#ffffff";
      //     this.ctx.moveTo(e.layerX - 0.01, e.layerY - 0.01);
      //     this.ctx.lineTo(e.layerX, e.layerY);
      //     this.ctx.stroke();

      this.updateBuffer();
    }
  }

  getColumnOfPixels(i) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height).data;

    const result = new Array(height).fill(null);

    for (let y = 0; y < height; y++) {
      const index = (y * width + i) * 4;
      const r = imageData[index];
      result[y] = r > 0 ? 1 : 0;
    }

    return result;
  }

  paintColumnBlack(i) {
    const height = this.canvas.height;
    this.onePixelImageDataData[0] = 0;
    this.onePixelImageDataData[1] = 0;
    this.onePixelImageDataData[2] = 0;
    this.onePixelImageDataData[3] = 255;
    this.ctx.putImageData(this.onePixelImageData, i, 0);

    for (let y = 0; y < height; y++) {
      this.ctx.putImageData(this.onePixelImageData, i, y);
    }
  }

  //   draw() {
  //     if (!this.node) return;
  //     // this.node.getByteTimeDomainData(this.dataArray);
  //     const canvasCtx = this.canvas.getContext("2d");
  //     canvasCtx.fillStyle = "#000000";
  //     canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  //     canvasCtx.lineWidth = 2;
  //     canvasCtx.strokeStyle = "#ffffff";
  //     canvasCtx.beginPath();

  //     const sliceWidth = this.canvas.width / this.bufferLength;
  //     let x = 0;

  //     for (let i = 0; i < this.bufferLength; i++) {
  //       const v = this.dataArray[i] / 128.0;
  //       const y = v * (this.canvas.height / 2);

  //       if (i === 0) {
  //         canvasCtx.moveTo(x, this.canvas.height - y);
  //       } else {
  //         canvasCtx.lineTo(x, this.canvas.height - y);
  //       }

  //       x += sliceWidth;
  //     }
  //     canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
  //     canvasCtx.stroke();

  //     // canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  //     requestAnimationFrame(() => this.draw());
  //   }
}
