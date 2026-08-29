class PeakDetectorComponent extends Component {
  static name = "Peak Detector";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.customAudioTriggers = ["reset"];
    this.infoText =
      "this module outputs the highest absolute value of the input, measured in voltage/amplitude. It can be resetted with the 'reset' trigger input ";
    this.createNode();
  }

  handleTriggerFromWorklet(e) {
    if (this.sabBlock) {
      this.sabBlock.setNote(1);
      this.sabBlock.publish();
    }
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/peakDetectorWorklet.js")
      .then(() => {
        this.node = this.makeWorklet("peak-detector-worklet",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
          }
        );

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
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
