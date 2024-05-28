class Mic extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Microphone module. It outputs the signal coming from the mic. I also wanna put here a select with every single line in / mic available in the device";
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    navigator.getUserMedia(
      { video: false, audio: true },
      (stream) => this.createNode(stream),
      console.warn
    );

    this.addSelectWithAllTheAudioInputs();

    // this.createInputButtons();
  }

  async addSelectWithAllTheAudioInputs() {
    this.sel = document.createElement("select");
    this.container.appendChild(this.sel);
    this.audioInputs = [];
    this.sel.onchange = (e) => {
      console.log(this.sel.value);
      var constraints = { deviceId: { exact: this.sel.value } };
      navigator.mediaDevices
        .getUserMedia({ video: false, audio: constraints })
        .then((stream) => {
          this.createNode(stream);
        });
    };
    // this.sel.classList.add("
    (await navigator.mediaDevices.enumerateDevices())
      .filter((k) => k.kind == "audioinput")
      .map((input) => {
        this.audioInputs.push(input);
        let option = document.createElement("option");
        option.value = input.deviceId;
        option.innerHTML = input.label;
        this.sel.appendChild(option);
      });
  }
  // updateNode(stream) {
  //   console.log(stream);
  //   this.node.mediaStream = stream;
  // }
  createNode(stream) {
    if (this.node) {
      
      this.node.disconnect();
      this.node = null;
    }
    this.node = this.app.actx.createMediaStreamSource(stream);
    this.resetMyConnections();

    // for(let c of this.)

    // this
    // mic.connect(spe);
    // spe.connect(ctx.destination);
    // draw();
  }
}
