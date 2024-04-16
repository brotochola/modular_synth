class Multiplexor extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.which = 0;
    this.createNode();
    this.text = document.createElement("p");
    this.text.innerHTML =
      "input 0 sets which of the other 8 inputs will be at the output<br> if the input is 1, the output will take the input 1, if the input is set at 2, etc";
    this.container.appendChild(this.text);
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/multiplexorWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "multiplexor-worklet", {
          numberOfInputs: 8,
          numberOfOutputs: 1,
          parameterData: { which: 0 },
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) =>
          console.log("#multiplexor worklet", e.data);
      });
  }
}
