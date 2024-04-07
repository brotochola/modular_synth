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

  addCompoWorklet() {
    this.components.push(new CompoWorklet(this));
  }

  addFilePlayer() {
    this.components.push(new FilePlayer(this));
  }
  

  addVisualizer() {
    this.components.push(new Visualizer(this));
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
  addDelay() {
    this.components.push(new Delay(this));
  }
  addMerger() {
    this.components.push(new Merger(this));
  }
  addNoise() {
    this.components.push(new Noise(this));
  }
  addMouse() {
    this.components.push(new Mouse(this));
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

  resetAllConnections() {
    for (let c of this.getAllConnections()) {
      c.reset();
    }
  }

  removeConnectionToMe(compo, audioParam) {
    // debugger
    this.components.map((k) =>
      k.connections.map((c) => {
        if (c.to == compo && c.audioParam == audioParam) {
          c.remove();
        }
      })
    );
  }

  serialize(){
    let obj={components:[], connections:[]}
    for(let comp of this.components){
      obj.components.push(comp.serialize())
    }
    for(let conn of this.getAllConnections()){
      obj.connections.push(conn.serialize())
    }
    return obj
  }

  loadFromFile(){
    
  }
}
