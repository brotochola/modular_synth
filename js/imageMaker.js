class ImageMaker extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.width = 215;
    this.height = 121;

    this.totalPixels = this.height * this.width;
    this.makeImageArrayEmpty();

    this.createCanvas();
    this.createNode();
    this.createButtonToToggleFullscreen();
    this.pixelCounter = 0;
    this.lineCounter = 0;
    this.lastImageProcessed = 0;
    this.img1 = new Image();

    this.startTime = this.app.actx.currentTime;
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
        this.container.append(this.canvas);
      } else {
        this.app.container.append(this.canvas);
      }
    };
    this.container.appendChild(this.toggle);
  }
  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.willReadFrequently = true;
    this.canvas.classList.add("imgMakerCanvas");

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.tempCanvas1 = document.createElement("canvas");
    this.tempCanvas1.width = this.width;
    this.tempCanvas1.height = this.height;
    this.tempCanvas1.willReadFrequently = true;
    this.tempCtx1 = this.tempCanvas1.getContext("2d");
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
    // console.log("#",e.data)
    this.dataFromWorklet = e.data;
    this.pixelCounter += 128;
    for (let i = 0; i < e.data.length; i++) {
      //4 inputs: rgba
      let color = i == 0 ? "r" : i == 1 ? "g" : i == 2 ? "b" : "a";
      //channel data, the values of audio, that i'm going to use as pixel values
      //[0] becase i dont care about stereo audio signals
      let channel = e.data[i][0] || [];
      for (let v = 0; v < channel.length; v++) {
        let pixelNumber = (this.pixelCounter + v) % this.totalPixels;
        this.imageArray[pixelNumber * 4 + i] = channel[v];
      }
    }

    //when it reaches the end, it makes the image
    if (this.pixelCounter >= this.totalPixels) {
      this.pixelCounter = this.pixelCounter - this.totalPixels;

      this.makeImage();
    }
  }

  fadeImages() {
    if (!this.ctx || isNaN(this.deltaTime)) return;

    this.tempCtx1.putImageData(this.imgData, 0, 0);

    this.img1.src = this.tempCanvas1.toDataURL();

    this.startTime = this.app.actx.currentTime;
    //I NEED TO KNOW HOW MANY FRAMES THIS CAN PROCESS BETWEEN THE MAKEIMAGE FUNCTIONS
    this.numOfFramesToFade = this.counter;
    this.counter = 0;
  }

  loop() {
    if (this.imgData && this.deltaTime && this.ready) {
      
      this.counter++;
      //BECAUSE I KNOW HOW MANY FRAMES WERE PROCESSED BETWEEN EACH IMAGE UPDATE
      //(WHENEVER THE IMAGE BUFFER GOT AS MANY PIXELS AS THE CANVAS NEEDS)
      //I DRAW WITH THE EXACT AMOUNT OF OPACITY SO BY THE SUM OF EACH CONSECUTIVE
      //DRAW I GET THE FULL OPACITY (1)
      this.ctx.globalAlpha = 1 / this.numOfFramesToFade;
      this.ctx.drawImage(
        this.img1,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }

    requestAnimationFrame((e) => this.loop(e));
  }

  makeImage() {
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
    }
    this.deltaTime = this.app.actx.currentTime - this.lastImageProcessed;
    this.lastImageProcessed = this.app.actx.currentTime;
    this.fadeImages();
    this.makeImageArrayEmpty();
  }
  makeImageArrayEmpty() {
    this.imageArray = [];
    for (let i = 0; i < this.width * this.height; i++) {
      this.imageArray[i * 4] = 0;
      this.imageArray[i * 4 + 1] = 0;
      this.imageArray[i * 4 + 2] = 0;
      this.imageArray[i * 4 + 3] = 255;
    }
  }
}
