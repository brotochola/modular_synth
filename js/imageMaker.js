class ImageMaker extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.width = 215;
    this.height = 104;
    this.createCanvas();
    this.createNode();
    this.lineCounter = 0;
    this.imageArray = [];
    for (let i = 0; i < this.height; i++) {
      this.imageArray.push({});
    }
  }
  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/imageMakerAudioWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "image-maker-worklet", {
          numberOfInputs: 4,
          numberOfOutputs: 4,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.node.parent = this;
        this.node.port.onmessage = (e) => this.handleDataFromWorklet(e);

        this.createInputButtons();
      });
  }
  handleDataFromWorklet(e) {
    this.dataFromWorklet = e.data;

    for (let i = 0; i < e.data.length; i++) {
      //I KNOW THERE'S ONLY ONE CHANNEL BECAUSE THIS COMPONENT/MODULE WILL ALWAYS BE MONO AND NOT STEREO

      let color = i == 0 ? "r" : i == 1 ? "g" : i == 2 ? "b" : "a";
      //EACH LINE OF THIS ARRAY WILL BE A HORIZONTAL LINE IN THE IMAGE

      let channel = e.data[i][0];
      // let obj={color,channel}

      this.imageArray[this.lineCounter][color] = channel;
    }

    this.lineCounter++;
    if (this.lineCounter >= this.height) {
      this.lineCounter = 0;

      this.makeImage();
    }
  }

  makeImage() {
    let imgData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    for (let y = 0; y < this.height; y++) {
      for (var x = 0; x < this.width; x++) {
        let pixelIndex = (y * this.width + x) * 4;

        imgData.data[pixelIndex] = (this.imageArray[y].r || [])[x] || 0;
        imgData.data[pixelIndex + 1] = (this.imageArray[y].g || [])[x] || 0;
        imgData.data[pixelIndex + 2] = (this.imageArray[y].b || [])[x] || 0;
        imgData.data[pixelIndex + 3] = 255;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }
}
