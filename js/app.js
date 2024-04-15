class App {
  constructor(elem) {
    this.components = [];
    this.actx = new AudioContext();
    this.bpm = 120;
    this.createMainContainer(elem);
    this.createOutputComponent();
  }

  getNextBeat() {
    let durationOf4Beats = (60 / 120) * 4;
    return durationOf4Beats - (this.actx.currentTime % durationOf4Beats);
  }

  createMainContainer(elem) {
    this.container = document.createElement("div");
    this.container.classList.add("mainContainer");
    this.container.draggable = true;
    this.dragStartedAt = [0, 0];

    elem.appendChild(this.container);
    this.SAVE_PREFIX = "modular_synth_";
    this.container.ondragend = (e) => {
      let x = e.clientX - this.dragStartedAt[0];
      let y = e.clientY - this.dragStartedAt[1];
      this.container.style.left = x + "px";
      this.container.style.top = y + "px";
      this.putCSSVariablesInMainContainer(x, y);
      this.updateAllLines();
    };
    this.container.ondragstart = (e) => {
      this.dragStartedAt[0] = e.layerX;
      this.dragStartedAt[1] = e.layerY;
    };
    this.putCSSVariablesInMainContainer(0, 0);
  }
  putCSSVariablesInMainContainer(x, y) {
    this.container.style.setProperty("--mainContainerX", x + "px");
    this.container.style.setProperty("--mainContainerY", y + "px");
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
  addEnvelope() {
    this.components.push(new EnvelopeGenerator(this));
  }
  addOscillator() {
    this.components.push(new Oscillator(this));
  }

  addImagePlayer() {
    this.components.push(new ImagePlayerWorkletVersion(this));
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
    this.components.push(new NoiseGenWithWorklet(this));
  }
  addMouse() {
    this.components.push(new Mouse(this));
  }

  addImageMaker() {
    this.components.push(new ImageMaker(this));
  }

  addAudioPlayer() {
    this.components.push(new AudioPlayer(this));
  }

  addSequencer() {
    this.components.push(new Sequencer(this));
  }

  addNumberDisplay() {
    this.components.push(new NumberDisplayComponent(this));
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
    }, 300);
  }
  addSerializedConnection(conn) {
    let componentsFrom = app.components.filter((k) => k.id == conn.from);
    let componentsTo = app.components.filter((k) => k.id == conn.to);
    if (componentsFrom.length && componentsTo.length) {
      try {
        componentsFrom[0].connect(
          componentsTo[0],
          conn.audioParam,
          conn.numberOfOutput
        );
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
    localStorage[this.SAVE_PREFIX + name] = JSON.stringify(this.serialize());
  }
  load() {
    let list = "";
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(this.SAVE_PREFIX)) {
        list += key + "\n";
      }
    });
    let name = prompt("which one \n" + list);
    if (!name) return;
    if (!localStorage[this.SAVE_PREFIX + name]) return;
    this.loadFromFile(JSON.parse(localStorage[this.SAVE_PREFIX + name]));
  }
}
