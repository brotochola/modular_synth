class Mouse extends Component {
  constructor(app) {
    super(app, "mouse");

    // this.osc = new OscillatorNode(this.app.actx);
    // this.osc.type = "square";
    // this.osc.frequency.value = 0;
    this.node = new GainNode(this.app.actx);
    // this.osc.connect(this.node);
    this.selectedCoord = "x";

    this.app.container.addEventListener("mousemove", (e) => {
      
      let height = window.innerWidth
      let width = window.innerHeight
      this.x = (width - e.pageX) / width;
      this.y = (height - e.pageY) / height;

      this.node.gain.value = this[this.selectedCoord];
    });

    this.app.actx.audioWorklet
      .addModule("js/fixedValueAudioWorklet.js")
      .then(() => {
        this.audioWorkletNode = new AudioWorkletNode(
          this.app.actx,
          "fixed-value-worklet"
        );

        this.audioWorkletNode.connect(this.node);
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
