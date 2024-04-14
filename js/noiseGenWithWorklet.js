class NoiseGenWithWorklet extends Component {
  
  constructor(app,serializedData) {
    super(app,serializedData);

    this.app.actx.audioWorklet.addModule("js/audioWorklets/whiteNoiseWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "white-noise-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
      });
     
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.node.parent = this;      
      this.node.port.onmessage = (e) => console.log("##noise compo", e.data);

      // this.createInputButtons();
    });
  }
}
