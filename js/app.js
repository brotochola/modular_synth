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
  addGainNode() {
    this.components.push(new Amp(this));
  }
  createOutputComponent() {
    this.components.push(new Output(this));
  }
}
