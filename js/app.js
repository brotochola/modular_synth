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
      if (c.type.toLowerCase() == "output") {
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
  addCustomProcessor() {
    this.components.push(new CustomProcessorComponent(this));
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

  removeAllConnections(compo) {
    // debugger
    this.components.map((k) =>
      k.connections.map((c) => {
        if (c.to == compo || c.from == compo) {
          c.remove();
        }
      })
    );
  }

  serialize() {
    let obj = { components: [], connections: [] };
    for (let comp of this.components) {
      obj.components.push(comp.serialize());
    }
    for (let conn of this.getAllConnections()) {
      obj.connections.push(conn.serialize());
    }
    return obj;
  }

  loadFromFile(obj) {
    for (let c of this.components) {
      c.remove();
    }
    for (let comp of obj.components) {
      this.addSerializedComponent(comp);
    }

    setTimeout(() => {
      for (let c of obj.connections) {
        this.addSerializedConnection(c);
      }
      this.resetAllConnections();
      this.actx.resume();
      this.updateAllLines();
    }, 600);
  }
  addSerializedConnection(conn) {
    let componentsFrom = app.components.filter((k) => k.id == conn.from);
    let componentsTo = app.components.filter((k) => k.id == conn.to);
    if (componentsFrom.length && componentsTo.length) {
      try {
        componentsFrom[0].connect(componentsTo[0], conn.audioParam);
      } catch (e) {
        console.warn(e);
      }
    }
  }
  addSerializedComponent(comp) {
    let c = eval(comp.constructor);
    this.components.push(new c(this, comp));
  }

  save() {
    let name = prompt("name the instrument");
    if (!name) return;
    localStorage[name] = JSON.stringify(this.serialize());
  }
  load() {
    let name = prompt("which one");
    if (!name) return;
    if (!localStorage[name]) return;
    this.loadFromFile(JSON.parse(localStorage[name]));
  }
}
