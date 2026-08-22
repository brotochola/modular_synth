class Demultiplexor extends Component {
  static name = "Demultiplexor";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Demultiplexor / 1→8 switch. The which input selects which of the eight outputs receives the signal (0–7). Other outs stay silent. CV-addressed opposite of Multiplexor — route one clock or CV to different destinations.";
    this.which = 0;
    this.outputLabels = ["0", "1", "2", "3", "4", "5", "6", "7"];
    this.createNode();
    this.createDisplay();
  }

  getParamInputLimits(name) {
    if (name == "which") return { min: 0, max: 7, step: 1 };
    return super.getParamInputLimits(name);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/demultiplexorWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "demultiplexor-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 8,
        parameterData: { which: 0 },
      });

      this.node.onprocessorerror = (e) => {
        console.error(e);
      };

      this.node.port.onmessage = (e) => {
        if (e.data.which != null && this.display) {
          this.display.innerHTML = e.data.which;
        }
      };
      if (this.display) this.display.innerHTML = "0";
    });
  }

  putLabels() {
    super.putLabels();
    let sig = this.container.querySelector("button.in_0");
    if (sig) {
      sig.innerText = "signal";
      sig.title = "signal";
    }
  }
}
