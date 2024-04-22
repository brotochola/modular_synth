class Multiplexor extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.which = 0;
    this.createNode();
    this.text = document.createElement("p");
    this.text.innerHTML =
      "The 'which' input sets which input will come out from the output<br> If it has a 0 as which, it will output a 0";
    this.container.appendChild(this.text);
    this.createDisplay();
  }

  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
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

        this.node.port.onmessage = (e) => {
          if (e.data.which) {
            this.display.innerHTML = e.data.which;
          }
        };
      });
  }
}
