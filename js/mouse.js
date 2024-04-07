class Mouse extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    ////
    //ConstantSourceNode

    // this.osc = new OscillatorNode(this.app.actx);
    // this.osc.type = "square";
    // this.osc.frequency.value = 0;

    this.bufferSize = 2 * this.app.actx.sampleRate;
    this.noiseBuffer = this.app.actx.createBuffer(
      1,
      this.bufferSize,
      this.app.actx.sampleRate
    );
    this.output = this.noiseBuffer.getChannelData(0);
    for (var i = 0; i < this.bufferSize; i++) {
      this.output[i] = 1;
    }

    this.generator = this.app.actx.createBufferSource();
    this.generator.buffer = this.noiseBuffer;
    this.generator.loop = true;
    this.generator.start(0);
    

    this.node = new GainNode(this.app.actx);
    this.node.parent = this;
    this.node.gain.value = 1;
    this.generator.connect(this.node)

    // this.osc.connect(this.node);
    this.selectedCoord = "x";

    this.app.container.addEventListener("mousemove", (e) => {
      let height = window.innerWidth;
      let width = window.innerHeight;
      this.x = (width - e.pageX) / width;
      this.y = (height - e.pageY) / height;

      this.node.gain.value = this[this.selectedCoord];
    });

    this.createSelect();
  }

  createSelect() {
    this.xorY = document.createElement("select");

    let optionX = document.createElement("option");
    optionX.value = "x";
    optionX.innerText = "X";
    this.xorY.appendChild(optionX);

    let optionY = document.createElement("option");
    optionY.value = "y";
    optionY.innerText = "Y";
    this.xorY.appendChild(optionY);

    this.xorY.onchange = (e) => this.handleOnChange(e);
    this.container.appendChild(this.xorY);
  }
  handleOnChange(e) {
    this.selectedCoord = this.xorY.value;
  }
}
