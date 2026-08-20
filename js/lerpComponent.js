class LerpComponent extends Component {
  static name = "lerp";
  constructor(app, serializedData) {
    super(app, serializedData);

    this.val = 0;
    this.createNode();
    this.customAudioParams = ["time"];
  }
  handleCustomAudioParamChanged(e) {
    // console.log(e);
    this.node.port.postMessage({ time: e.current });
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/lerpWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "lerp-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });
        // this.node.port.postMessage({ bpm: this.app.bpm });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          if (e.data.count) {
            // this.val = e.data.count;
            // this.updateDisplay();
          }
        };
      });
  }
}
