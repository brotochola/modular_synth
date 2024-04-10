class ImagePlayer extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.imageDataParsed = [{ r: 0, g: 0, b: 0 }];
    this.createInputFile();
    this.selectedValue = "r";
    this.createSelect();
    this.createAudioBuffer();
  }

  createInputFile() {
    this.img = document.createElement("img");
    this.img.onload = (e) => this.handleImgOnLoad(e);
    this.canvas = document.createElement("canvas");
    this.canvas.willReadFrequently = true;

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.onchange = (e) => this.handleOnChange(e);
    this.container.appendChild(this.inputFile);
  }

  createSelect() {
    this.select = document.createElement("select");

    let optionR = document.createElement("option");
    optionR.value = "r";
    optionR.innerText = "R";
    this.select.appendChild(optionR);

    let optionG = document.createElement("option");
    optionG.value = "g";
    optionG.innerText = "G";
    this.select.appendChild(optionG);

    let optionB = document.createElement("option");
    optionB.value = "b";
    optionB.innerText = "B";
    this.select.appendChild(optionB);

    let optionA = document.createElement("option");
    optionA.value = "a";
    optionA.innerText = "A";
    this.select.appendChild(optionA);

    this.select.onchange = (e) => {
      this.selectedValue = this.select.value;
      try {
        this.node.stop();
      } catch (e) {}
      this.createAudioBuffer();
      this.app.resetAllConnections();
    };

    this.container.appendChild(this.select);
  }

  handleImgOnLoad() {
    this.canvas.width = this.img.naturalWidth;
    this.canvas.height = this.img.naturalHeight;
    this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.imageDataParsed = [];
    // debugger;
    for (let i = 0; i < this.imageData.data.length / 4; i++) {
      let idx = i * 4;
      this.imageDataParsed.push({
        r: this.imageData.data[idx],
        g: this.imageData.data[idx + 1],
        b: this.imageData.data[idx + 2],
        a: this.imageData.data[idx + 3],
      });
    }

    this.createAudioBuffer();
  }
  createAudioBuffer() {
    this.bufferSize = this.imageDataParsed.length; //2 * this.app.actx.sampleRate;

    this.audioBuffer = this.app.actx.createBuffer(
      1,
      this.bufferSize,
      this.app.actx.sampleRate
    );
    this.output = this.audioBuffer.getChannelData(0);
    for (var i = 0; i < this.imageDataParsed.length; i++) {
      let pixel = this.imageDataParsed[i];
      if (!pixel || pixel?.r == undefined) debugger;

      this.output[i] = (pixel[this.selectedValue] / 255) * 2 - 1;
    }

    this.node = this.app.actx.createBufferSource();
    this.node.parent = this;
    this.node.buffer = this.audioBuffer;
    this.node.loop = true;
    this.node.start(0);
  }
  handleOnChange(e) {
    try {
      this.node.stop();
    } catch (e) {}
    this.img.src = URL.createObjectURL(e.target.files[0]);

    // let reader = new FileReader();
    // reader.onload = () => {
    //   console.log(reader.result);
    // };

    // reader.readAsArrayBuffer(this.inputFile.files[0]);

    // fetch(this.inputFile.files[0].name, { mode: "cors" })
    //   .then((resp) => resp.arrayBuffer())
    //   .then((buffer) => {
    //     this.buffer = buffer;
    //     console.log(buffer);
    //   });
  }
}
