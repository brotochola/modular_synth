class ImageMaker extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.width = 215;
    this.height = 121;

    this.totalPixels = this.height * this.width;
    this.makeImageArrayEmpty();

    this.createCanvas();
    this.createNode();
    this.createButtonToToggleFullscreen()
    this.pixelCounter = 0;
    this.lineCounter = 0;

    // for (let i = 0; i < this.height; i++) {
    //   this.imageArray.push({});
    // }
  }
  createButtonToToggleFullscreen(){
    this.toggle=document.createElement("button");
    this.toggle.innerHTML = "Toggle Fullscreen";
    this.toggle.onclick=()=>this.canvas.classList.toggle("fullscreen")
    this.container.appendChild(this.toggle);
  }
  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.willReadFrequently = true;

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/imageMakerAudioWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "image-maker-worklet", {
          numberOfInputs: 4,
          numberOfOutputs: 0,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        
        this.node.port.onmessage = (e) => this.handleDataFromWorklet(e);

        // this.createInputButtons();
      });
  }
  handleDataFromWorklet(e) {
    this.dataFromWorklet = e.data;
    this.pixelCounter += 128;
    for (let i = 0; i < e.data.length; i++) {
      //4 inputs: rgba
      let color = i == 0 ? "r" : i == 1 ? "g" : i == 2 ? "b" : "a";
      //channel data, the values of audio, that i'm going to use as pixel values
      let channel = e.data[i][0] || [];
      for (let v = 0; v < channel.length; v++) {
        let pixelNumber = (this.pixelCounter + v) % this.totalPixels;
        this.imageArray[pixelNumber * 4 + i] = channel[v];
      }
    }

    //when it reaches the end, it makes the image
    if (this.pixelCounter >= this.totalPixels) {
      this.pixelCounter =  this.pixelCounter-this.totalPixels;

      this.makeImage();
    }
  }

  makeImage() {
    // console.log(this.imageArray)
    // debugger
    if (!this.imgData) {
      this.imgData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }
    
    for (let i = 0; i < this.imageArray.length; i++) {
      let newVal = this.imageArray[i] || 0;
      if (i == 3 && newVal == 0) newVal = 255; //alpha
      this.imgData.data[i] = newVal;
      //   this.imageArray[i] && console.log(this.imageArray[i]);
    }
    // for (let y = 0; y < this.height; y++) {
    //   for (var x = 0; x < this.width; x++) {
    //     let pixelIndex = (y * this.width + x) * 4;

    //     imgData.data[pixelIndex] = (this.imageArray[y].r || [])[x] || 0;
    //     imgData.data[pixelIndex + 1] = (this.imageArray[y].g || [])[x] || 0;
    //     imgData.data[pixelIndex + 2] = (this.imageArray[y].b || [])[x] || 0;
    //     imgData.data[pixelIndex + 3] = 255;
    //   }
    // }

    this.ctx.putImageData(this.imgData, 0, 0);
    this.makeImageArrayEmpty();
  }
  makeImageArrayEmpty() {
    this.imageArray=[]
    for (let i = 0; i < this.width * this.height; i++) {
      this.imageArray[i * 4] = 0;
      this.imageArray[i * 4 + 1] = 0;
      this.imageArray[i * 4 + 2] = 0;
      this.imageArray[i * 4 + 3] = 255;
    }
  }
}
