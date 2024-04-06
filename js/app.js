class App {
  constructor(elem) {
    this.container = elem;

    // this.container.ondrop=(e)=>this.onDrop(e)
    this.components = [];
    this.actx = new AudioContext();
    this.createOutputComponent();
  }

  getOutputComponent() {
    for (let c of this.components) {
      if (c.type == "output") {
        return c;
      }
    }
  }

  updateAllLines() {
    for (let c of this.components) {
      c.updateMyLines();
    }
  }
  //   onDrop(e){
  //     console.log(e)
  //   }
  addOscillator() {
    this.components.push(new Oscillator(this));
  }
  addFilter() {
    this.components.push(new Filter(this));
  }
  addGainNode() {
    this.components.push(new Amp(this));
  }
  createOutputComponent() {
    this.components.push(new Output(this));
  }

  getAllConnections() {
    let ret = [];
    this.components.map((k) =>
      k.connections.map((c) => {
        ret.push(c);
      })
    );

    return ret;
  }

  removeConnectionToMe(compo, audioParam) {
    this.components.map((k) =>
      k.connections.map((c) => {
        if (c.to == compo && c.audioParam == audioParam) {
          c.remove();
        }
      })
    );
  }
}
