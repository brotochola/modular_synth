class App {
  constructor(elem) {
    this.patchName = getParameterByName("patch");

    this.components = [];
    this.actx = new AudioContext();
    this.bpm = 100;
    this.createMainContainer(elem);
    this.createOutputComponent();
    this.createCanvasOnTop();

    this.putBPMInButton();
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key == "Delete") {
          for (let c of this.components.filter((k) => k.active)) {
            c.remove();
           
            break;
          }

          this.updateAllLines();
        }
      },
      false
    );

    this.wheelZoom();

    this.checkIfTheresAPatchToOpenInTheURL();
    setTimeout(() => this.startListeningToFirestoreChanges(), 2000);
  }

  startListeningToFirestoreChanges() {
    if (!this.patchName) return;
    listenToChangesInWholePatch(this.patchName, (e) => {
      console.log("### CHANGES IN THE PATCH", e);
      this.handleChangesInThisPatchFromFirestore(e);
    });
  }

  async checkIfTheresAPatchToOpenInTheURL() {
    if (!this.patchName) return;
    let loaded = await getDocFromFirebase(this.patchName);

    if (loaded) {
      console.log("#", this.patchName, " loaded from firestore", loaded);
      this.loadFromFile(loaded);
    } else {
      console.warn(this.patchName + " could not be loaded");
      //THIS IS BC THE OUTPUT COMPO WAS NOT LOADED YET
    }
  }

  compareTwoComponents(c1, c2) {
    let compC1, compC2;
    if (c1 instanceof Component) {
      compC1 = c1.serialize();
    } else {
      compC1 = c1;
    }
    if (c2 instanceof Component) {
      compC2 = c2.serialize();
    } else {
      compC2 = c2;
    }
    let json1 = JSON.stringify(sortObjectKeysAlphabetically(compC1));
    let json2 = JSON.stringify(sortObjectKeysAlphabetically(compC2));
    // console.log("####",json1, json2, json1 == json2);
    return json1 == json2;
  }

  handleChangesInThisPatchFromFirestore(e) {
    if (!e) return;
    if (e.components) {
      //THIS IS ONLY A LIST OF IDS IN THE DOC
      //INSIDE THIS DOC THERE'S A COLLECTION WITH ALL THE DOCUMENTS
      for (let c of e.components) {
        //C IS AN ID
        let currentCompo = this.getComponentByID(c);
        if (!currentCompo) {
          //GETS THE COMPONENT FROM THE COLLECTION, THE SERIALIZED COMPONENT
          getComponentFromFirestore(
            this.patchName,
            c,
            (serializedComponent) => {
              //COMPONENT DOESN'T EXIST IN THIS FRONTEND
              if (serializedComponent) {
                this.addSerializedComponent(serializedComponent);
              }
            }
          );
        }
      }

      //CHECK IF I GOTTA REMOVE SOME COMPONENT FROM THIS FRONTEND:

      let componentsWeHaveToRemove = this.components.filter(
        (k) => !e.components.includes(k.id)
      );

      for (let compo of componentsWeHaveToRemove) {
        if (compo instanceof Output) continue;
        compo.remove();
      }
    }

    //GET BPM
    if (e.bpm) {
      this.bpm = e.bpm;
      for (let c of this.components) {
        c.updateBPM();
      }
      this.putBPMInButton();
    }

    this.updateAllLines()
  }

  wheelZoom() {
    // this.container.onwheel = (event) => {
    //   this.scale += event.deltaY * 0.01;
    //   // Restrict scale
    //   this.scale = Math.min(Math.max(0.25, this.scale), 1);
    //   // Apply scale transform
    //   for (let el of document.querySelectorAll("component")) {
    //     el.style.transform = `scale(${this.scale})`;
    //   }
    //   // this.container.style.transformOrigin =
    //   //   event.clientX + "px " + event.clientY + "px";
    //   event.preventDefault();
    //   this.updateAllLines();
    // };
    // this.scale = 1;
  }
  putBPMInButton() {
    (document.querySelector(".buttons #bpmButton") || {}).innerHTML =
      "change BPM (" + this.bpm + ")";
  }
  createCanvasOnTop() {
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("linesCanvas");
    this.canvas.width = this.container.getBoundingClientRect().width;
    this.canvas.height = this.container.getBoundingClientRect().height;
    this.container.appendChild(this.canvas);
    this.canvas.onclick = (e) => console.log(e);
    this.ctx = this.canvas.getContext("2d");
  }
  drawLine(from, to, color) {
    this.ctx.beginPath();
    let box = this.container.getBoundingClientRect();
    let fromBox = from.getBoundingClientRect();
    let toBox = to.getBoundingClientRect();

    // let x1 = parseInt(from.container.style.left.replace("px",""))
    // let y1 = parseInt(from.container.style.top.replace("px",""))
    // let x2 = parseInt(tp.container.style.left.replace("px",""))
    // let y2 = parseInt(to.container.style.top.replace("px",""))

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = color || "red";
    let startX = fromBox.x - box.x + fromBox.width / 2;
    let startY = fromBox.y - box.y + fromBox.height / 2;
    this.ctx.moveTo(startX, startY);

    let endX = toBox.x - box.x + toBox.height / 2;
    let endY = toBox.y - box.y + toBox.height / 2;
    // let deviation = 100;
    // this.ctx.bezierCurveTo(
    //   startX + deviation,
    //   startY,
    //   endX - deviation,
    //   endY,
    //   endX,
    //   endY
    // );

    this.ctx.bezierCurveTo(endX, startY, startX, endY, endX, endY);
    this.ctx.stroke();
    // this.ctx.endPath();
  }

  getNextBeat() {
    let durationOf4Beats = (60 / 120) * 4;
    return durationOf4Beats - (this.actx.currentTime % durationOf4Beats);
  }

  makeAllComponentsInactive() {
    for (let c of this.components) {
      c.container.classList.remove("active");
      c.active = false;
    }
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
      this.makeAllComponentsInactive();
      this.dragStartedAt[0] = e.layerX;
      this.dragStartedAt[1] = e.layerY;
    };
    let box = this.container.getBoundingClientRect();
    this.putCSSVariablesInMainContainer(box.x, box.y);
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
    // console.trace("updateAllLines");
    this.ctx.clearRect(0, 0, 9999, 9999);
    setTimeout(() => {
      for (let c of this.getAllConnections()) {
        c.redraw();
      }
    }, 10);
  }
  addText() {
    this.components.push(new Text(this));
  }
  addBPMOutputComponenet() {
    this.components.push(new BPMOutputComponent(this));
  }

  addMultiplexor() {
    this.components.push(new Multiplexor(this));
  }
  addJoystick() {
    this.components.push(new JoystickComponent(this));
  }
  addEnvelope() {
    this.components.push(new EnvelopeGenerator(this));
  }
  addOscillator() {
    this.components.push(new Oscillator(this));
  }
  addDistortion() {
    this.components.push(new Distortion(this));
  }
  addCounter() {
    this.components.push(new CounterComponent(this));
  }
  addMemoryComponent() {
    this.components.push(new MemoryComponent(this));
  }

  addMidiPlayer() {
    this.components.push(new MidiFilePlayer(this));
  }

  addKeyboard() {
    this.components.push(new KeyboardComponent(this));
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
    let obj = { components: [], connections: [], bpm: this.bpm };
    for (let comp of this.components) {
      obj.components.push(comp.serialize());
    }
    for (let conn of this.getAllConnections()) {
      obj.connections.push(conn.serialize());
    }
    return obj;
  }

  loadFromFile(obj) {
    if (obj.bpm) this.bpm = obj.bpm;
    this.putBPMInButton();

    //REMOVE ALL
    for (let c of this.components) {
      c.remove();
    }
    //PUT THE OUTPUT WHERE IT WAS SAVED:
    this.updatePositionOfOutPutComponent(obj);

    //CREATE ALL COMPONENTS
    for (let comp of obj.components) {
      this.addSerializedComponent(comp);
    }

    this.waitUntilComponentsAreLoadedAndLoadConnections(obj);
  }

  async loadFromFireStore() {
    let keys = Object.keys(await getAllDocuments());

    let name = prompt(JSON.stringify(keys).replaceAll(",", "\n"));
    if (!name) return;
    let loadedDoc = await getDocFromFirebase(name);
    console.log("#loaded patch", loadedDoc);
    this.loadFromFile(loadedDoc);
  }

  updatePositionOfOutPutComponent(savedData) {
    if (!Array.isArray(savedData.components)) return;
    let outputCompo = this.getOutputComponent();
    let savedOutputcompo = (savedData.components.filter(
      (c) => c.type == "Output"
    ) || [])[0];
    if (savedOutputcompo) {
      outputCompo.container.style.left = savedOutputcompo.x;
      outputCompo.container.style.top = savedOutputcompo.y;
    }
  }

  waitUntilComponentsAreLoadedAndLoadConnections(obj) {
    console.log(
      "#waitUntilComponentsAreLoadedAndLoadConnections",
      obj,
      this.components
    );
    if (
      this.components.filter((k) => k.ready && k.id != "output").length !=
      obj.components.length
    ) {
      console.log(
        "$$NOT ALL COMPONENTS WERE LOADED YET",
        this.components.length,
        obj.components.length
      );
      setTimeout(
        () => this.waitUntilComponentsAreLoadedAndLoadConnections(obj),
        250
      );
    } else {
      setTimeout(() => {
        for (let c of obj.connections) {
          this.addSerializedConnection(c);
        }
        this.resetAllConnections();
        this.actx.resume();
        this.updateAllLines();
      }, 100);
    }
  }
  addSerializedConnection(conn) {
    console.log("## adding serialized connection", conn);
    let componentsFrom = app.components.filter((k) => k.id == conn.from);
    let componentsTo = app.components.filter((k) => k.id == conn.to);
    if (componentsFrom.length && componentsTo.length) {
      componentsFrom[0].connect(
        componentsTo[0],
        conn.audioParam,
        parseInt(conn.numberOfOutput)
      );
    } else {
      return console.warn("Couldn't find the components", conn);
    }
  }
  addSerializedComponent(comp) {
    console.log("## adding serialized component", comp.type, comp.id);
    if (!comp) {
      return console.trace("trying to add a null serialized component??");
    }
    if (comp.type == "Output" || comp.id == "output")
      return console.warn("YOU CANT CREATE OUTPUT COMPONENTS");
    let c = eval(comp.constructor);
    this.components.push(new c(this, comp));
  }

  save() {
    let name = prompt(
      "name the instrument, it will be saved in localStorage and in firebase"
    );
    if (!name) return;
    this.patchName = name;
    let serialized = this.serialize();
    localStorage[this.SAVE_PREFIX + name] = JSON.stringify(serialized);
    saveInFireStore(serialized, name);
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

  changeBPM() {
    let val = prompt("bpm");
    val = parseInt(val);
    if (isNaN(val)) return;
    this.bpm = val;
    putBPMInFireStore(this.patchName, this.bpm);
    for (let c of this.components) {
      c.updateBPM();
    }
    this.putBPMInButton();
  }

  download() {
    downloader(
      JSON.stringify(this.serialize()),
      "application/json",
      "my_patch.json"
    );
  }

  getComponentByID(id) {
    return this.components.filter((c) => c.id == id)[0];
  }

  saveListOfComponentsInFirestore() {
    if (!this.patchName) return;
    saveInFireStore(
      {
        bpm: this.bpm,
        components: this.components
          .filter((k) => k.id != "output")
          .map((k) => k.id),
      },
      this.patchName
    );
  }
}
