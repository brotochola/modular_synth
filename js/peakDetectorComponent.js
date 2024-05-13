class PeakDetectorComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.customAudioTriggers = ["reset"];
    this.infoText =
      "this module outputs the highest absolute value of the input, measured in voltage/amplitude. It can be resetted with the 'reset' trigger input ";
    this.createNode();
  }

  handleTriggerFromWorklet(e) {
    this.node.port.postMessage("reset");
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/peakDetectorWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(
          this.app.actx,
          "peak-detector-worklet",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.node.port.onmessage = (e) => {
          console.log("#msg in peak detector", e.data);
        };

        // setTimeout(() => this.putLabels(), 200);
      });
  }
  //   putLabels() {
  //     this.outputElements = Array.from(
  //       this.container.querySelectorAll(".outputButton")
  //     );

  //     for (let i = 0; i < this.outputElements.length; i++) {
  //       let elem = this.outputElements[i];
  //       //   console.log(elem, i, this.letters[i]);
  //       elem.style.setProperty("--letter", "'" + (i + 1) + "'");
  //     }
  //   }
}
