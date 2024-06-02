class App {
  static signalignServers = [
    "stun.l.google.com",
    "stun1.l.google.com:19302",
    "stun2.l.google.com:19302",
    "stun3.l.google.com:19302",
    "stun4.l.google.com:19302",
    "stun.rixtelecom.se",
    "stun.schlund.de",
    "stun.stunprotocol.org:3478",
    "stun.voiparound.com",
    "stun.voipbuster.com",
    "stun.voipstunt.com",
    "stun.voxgratia.org",
    "stun.ekiga.net",
  ];
  constructor(elem) {
    this.patchName = getParameterByName("patch");

    this.components = [];
    this.actx = new AudioContext();
    this.bpm = 100;
    this.createMainContainer(elem);
    this.createMessageBox();
    this.createOutputComponent();
    this.createCanvasOnTop();
    this.addEventsToDropFile();

    this.putBPMInButton();

    this.generateUserAndSessionIDs();
    document.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key == "Delete") {
          for (let c of this.components.filter((k) => k.active)) {
            c.remove();
            this.saveListOfComponentsInFirestore();
            break;
          }

          this.updateAllLines();
        }
      },
      false
    );

    this.wheelZoom();

    this.buttonsContainer = document.querySelector(".buttons");

    // this.checkIfTheresAPatchToOpenInTheURL();
    setTimeout(() => this.startListeningToFirestoreChanges(), 1000);
  }
  showMessage(text) {
    this.messageBox.classList.add("visible");
    this.messageBox.onclick = () => {
      clearTimeout(this.messageBoxTimeoutVar);
      this.messageBox.classList.remove("visible");
    };
    this.messageBox.innerHTML = text;
    let delay = 3000 + text.length * 30;
    clearTimeout(this.messageBoxTimeoutVar);
    this.messageBoxTimeoutVar = setTimeout(
      () => this.messageBox.classList.remove("visible"),
      delay
    );
  }
  createMessageBox() {
    this.messageBox = document.createElement("div");
    this.messageBox.classList.add("messageBox");
    document.body.appendChild(this.messageBox);
  }
  generateUserAndSessionIDs() {
    if (!localStorage.getItem("user_id")) {
      localStorage["user_id"] = "user_" + makeid(5);
    }
    this.userID = localStorage.getItem("user_id");
    this.sessionID = makeid(12);
    this.container.style.setProperty("--userID", this.userID);
  }
  addEventsToDropFile() {
    document.body.ondrop = (ev) => {
      // console.log(ev);
      let files = [];
      if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        [...ev.dataTransfer.items].forEach((item, i) => {
          // If dropped items aren't files, reject them
          if (item.kind === "file") {
            files.push(item.getAsFile());
            // console.log(file);
          }
        });
      } else {
        // Use DataTransfer interface to access the file(s)
        [...ev.dataTransfer.files].forEach((file, i) => {
          files.push(file);
        });
      }
      if (files.length == 0) return;
      // console.log("## result", files)

      let reader = new FileReader();
      reader.onload = async () => {
        // this.unsubscribeFromFirestore();
        try {
          this.loadedJSON = JSON.parse(reader.result);
          this.loadFromFile(this.loadedJSON);
          // //IF THERE IS A PATCH NAME IN THE URL, AND YOU DROP A JSON FILE THAT COULD LOAD BE LOADED
          // //IT WILL OVERWRITE THE PATCH
          // if (this.patchName) {
          //   this.waitUntilAllComopnentsAreReady(() =>
          //     setTimeout(()=>this.save(this.patchName),500)
          //   );
          // }
        } catch (e) {
          console.warn("error with this json file", e);
        }
      };

      reader.readAsText(files[0]);

      ev.preventDefault();
    };

    document.body.ondragover = (e) => {
      // console.log(e);
      e.preventDefault();
    };
  }

  startListeningToFirestoreChanges() {
    if (!this.patchName) return;
    if (this.listeningToFirestore) return;
    this.waitUntilAllComopnentsAreReady(() => {
      this.functionToUnsubscribeFromFirestore = listenToChangesInWholePatch(
        this.patchName,
        (e) => {
          console.log("#!!! changes", e);
          this.lastChangedFromFirestore = e;
          this.handleChangesInThisPatchFromFirestore(e);
        },
        this.sesstionID,
        this.userID
      );
      this.listeningToFirestore = true;
    });
  }

  // async checkIfTheresAPatchToOpenInTheURL() {
  //   if (!this.patchName) return;
  //   let loaded = await getDocFromFirebase(this.patchName);

  //   if (loaded) {
  //     console.log("#", this.patchName, " loaded from firestore", loaded);
  //     this.loadFromFile(loaded);
  //   } else {
  //     console.warn(this.patchName + " could not be loaded");
  //     //THIS IS BC THE OUTPUT COMPO WAS NOT LOADED YET
  //   }
  // }

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
    if (e.sessionID == this.sessionID && e.userID == this.userID) {
      return; // console.warn("THESEA RE YOUR OWN CHANGES");
    }
    if (e.components) {
      //THIS IS ONLY A LIST OF IDS IN THE DOC
      //INSIDE THIS DOC THERE'S A COLLECTION WITH ALL THE DOCUMENTS
      for (let c of e.components) {
        //C IS AN ID
        let currentCompo = this.getComponentByID(c);
        if (!currentCompo) {
          // console.log("##### el compo no se encontró", c, this.components);
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
      // if(componentsWeHaveToRemove.length ==this.components.length) {}

      for (let compo of componentsWeHaveToRemove) {
        if (compo instanceof Output) continue;
        compo.remove(true);
      }
    }

    //THE POSITION OF THE OUTPUT COMPONENT IS SAVED IN THE INFO OF THE PATCH
    //AND NOT AS A SEPARATED COMPONENT
    if (e.outputX) {
      let output = this.getOutputComponent();
      output.container.style.left = e.outputX;
      output.container.style.top = e.outputY;
    }

    //GET BPM
    if (e.bpm) {
      this.bpm = e.bpm;
      for (let c of this.components) {
        c.updateBPM();
      }
      this.putBPMInButton();
    }

    this.updateAllLines();
  }

  wheelZoom() {
    this.container.onwheel = (event) => {
      event.preventDefault();
      if (
        (this.scale == 1 && event.deltaY < 0) ||
        (this.scale == 0.25 && event.deltaY > 0)
      ) {
        return;
      }
      this.scale -= event.deltaY * 0.0005;
      // Restrict scale
      this.scale = Math.min(Math.max(0.25, this.scale), 1);

      let box = this.container.getBoundingClientRect();
      let currentWidth = box.width * this.scale;
      let lastWidth = box.width * this.lastScale;

      let currentHeight = box.height * this.scale;
      let lastHeight = box.height * this.lastScale;

      let widthsDiff = ((lastWidth - currentWidth) / this.scale) * 0.2;
      let heightsDiff = ((currentHeight - lastHeight) / this.scale) * 0.2;

      let x = box.x;
      let y = box.y;

      let difX = event.x - window.innerWidth / 2;
      let difY = event.y - window.innerHeight / 2;
      console.log(difX, difY);

      if (event.deltaY < 0) {
        this.container.style.left =
          x - Math.abs(widthsDiff) - difX * this.scale * 0.2 + "px";
        this.container.style.top =
          y - Math.abs(widthsDiff) - difY * this.scale * 0.2 + "px";
      } else {
        this.container.style.left = x + Math.abs(widthsDiff) + "px";
        this.container.style.top = y + Math.abs(heightsDiff) + "px";
      }
      this.container.style.zoom = this.scale * 100 + "%";
      // event.preventDefault();
      // this.updateAllLines();
      this.container.parentNode.style.setProperty("--scale", this.scale);
      this.lastScale = this.scale;

      this.container.parentNode.classList.add("zooming");
      clearTimeout(this.wheelTimeoutVar);
      this.wheelTimeoutVar = setTimeout(() => {
        this.container.parentNode.classList.remove("zooming");
      }, 50);
    };
    this.scale = 1;
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
    // this.canvas.onclick = (e) => console.log(e);
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
      let x = (e.clientX - this.dragStartedAt[0]) / this.scale;
      let y = (e.clientY - this.dragStartedAt[1]) / this.scale;
      this.container.style.left = x + "px";
      this.container.style.top = y + "px";
      this.putCSSVariablesInMainContainer(x, y);
      this.updateAllLines();
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    this.container.ondragstart = (e) => {
      this.makeAllComponentsInactive();
      this.dragStartedAt[0] = e.layerX;
      this.dragStartedAt[1] = e.layerY;
    };
    this.container.onmousemove = (e) => {
      if (e.x < 160) {
        this.buttonsContainer.classList.add("visible");
      } else {
        this.buttonsContainer.classList.remove("visible");
      }
    };

    let box = this.container.getBoundingClientRect();
    this.putCSSVariablesInMainContainer(box.x, box.y);
  }
  putCSSVariablesInMainContainer(x, y) {
    document.body.style.setProperty("--mainContainerX", x + "px");
    document.body.style.setProperty("--mainContainerY", y + "px");
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
    this.ctx.clearRect(0, 0, 9999, 9999);
    setTimeout(() => {
      for (let c of this.getAllConnections()) {
        c.redraw();
      }
    }, 10);
  }
  addText() {
    this.components.push(new Text(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addBPMOutputComponenet() {
    this.components.push(new BPMOutputComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addMultiplexor() {
    this.components.push(new Multiplexor(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addJoystick() {
    this.components.push(new JoystickComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addEnvelope() {
    this.components.push(new EnvelopeGenerator(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addRackCover() {
    this.components.push(new RackCover(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addConstantValueNode() {
    this.components.push(new ConstantValueNode(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addOscillator() {
    this.components.push(new Oscillator(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addPitchDetector() {
    this.components.push(new PitchDetectorComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addPadSampler() {
    this.components.push(new PadSampler(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addSpectrum2Image() {
    this.components.push(new Spectrum2Image(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addSpectrogram() {
    this.components.push(new Spectrogram(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addPitchDetector2() {
    this.components.push(new PitchDetector2(this));
    //   this.saveListOfComponentsInFirestore();
  }
  // addBPMDetector() {
  //   this.components.push(new BPMDetector(this));
  //   //   this.saveListOfComponentsInFirestore();
  // }
  addLerpComponent() {
    this.components.push(new LerpComponent(this));
  }

  addWebcamPlayer() {
    this.components.push(new WebcamPlayer(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addAiComponent() {
    this.components.push(new AiComponent(this));
  }

  addPeakDetector() {
    this.components.push(new PeakDetectorComponent(this));
  }

  addCompressor() {
    this.components.push(new Compressor(this));
  }

  addMidiInput() {
    this.components.push(new Midi(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addReverb() {
    this.components.push(new Reverb(this));
  }
  addWaveShaper() {
    this.components.push(new WaveShaper(this));
  }

  addFrequencyAnalizer() {
    this.components.push(new FrequencyAnalizer(this));
  }

  addRTCReceiver() {
    this.components.push(new WebRTCReceiver(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addRTCSender() {
    this.components.push(new WebRTCSender(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addMic() {
    this.components.push(new Mic(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addDistortion() {
    this.components.push(new Distortion(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addCounter() {
    this.components.push(new CounterComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addMemoryComponent() {
    this.components.push(new MemoryComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addMidiPlayer() {
    this.components.push(new MidiFilePlayer(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addKeyboard() {
    this.components.push(new KeyboardComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addImagePlayer() {
    this.components.push(new ImagePlayerWorkletVersion(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addVisualizer() {
    this.components.push(new Visualizer(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addCustomProcessor() {
    this.components.push(new CustomProcessorComponent(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addFilter() {
    this.components.push(new Filter(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addGainNode() {
    this.components.push(new Amp(this));
    //   this.saveListOfComponentsInFirestore();
  }
  createOutputComponent() {
    this.components.push(new Output(this));
  }
  addDelay() {
    this.components.push(new Delay(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addMerger() {
    this.components.push(new Merger(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addNoise() {
    this.components.push(new NoiseGenWithWorklet(this));
    //   this.saveListOfComponentsInFirestore();
  }
  addMouse() {
    this.components.push(new Mouse(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addImageMaker() {
    this.components.push(new ImageMaker(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addAudioPlayer() {
    this.components.push(new AudioPlayer(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addSequencer() {
    this.components.push(new Sequencer(this));
    //   this.saveListOfComponentsInFirestore();
  }

  addNumberDisplay() {
    this.components.push(new NumberDisplayComponent(this));
    //   this.saveListOfComponentsInFirestore();
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
    let serializedOutputComponent = this.getOutputComponent().serialize();
    let obj = {
      components: [],
      connections: [],
      bpm: this.bpm,
      outputX: serializedOutputComponent.x,
      outputY: serializedOutputComponent.y,
    };

    for (let comp of this.components) {
      if (!(comp instanceof Output)) obj.components.push(comp.serialize());
    }
    // for (let conn of this.getAllConnections()) {
    //   obj.connections.push(conn.serialize());
    // }
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

    setTimeout(() => {
      this.resetAllConnections();
      this.actx.resume();
      this.updateAllLines();
    }, 200);
  }

  async loadFromFireStore() {
    let keys = Object.keys(await getAllDocuments());

    let name = prompt(JSON.stringify(keys).replaceAll(",", "\n"));
    if (!name) return;
    let loadedDoc = await getDocFromFirebase(name);
    // console.log("#loaded patch", loadedDoc);
    this.loadFromFile(loadedDoc);
  }

  updatePositionOfOutPutComponent(savedData) {
    let outputCompo = this.getOutputComponent();

    outputCompo.container.style.left = savedData.outputX;
    outputCompo.container.style.top = savedData.outputY;
  }

  waitUntilAllComopnentsAreReady(cb, counter) {
    if (!counter) counter = 1;
    else counter++;
    let notReadyComponents = this.components.filter((k) => !k.ready);
    let isItStillLoadingComponents =
      ((this.lastChangedFromFirestore || {}).components || []).length !=
      this.components.length - 1;
    if (notReadyComponents.length > 0 || isItStillLoadingComponents) {
      if (counter > 20) {
        return console.warn(
          "components didn't load :(",
          "notReadyComponents",
          notReadyComponents.length,
          "isItStillLoadingComponents:",
          isItStillLoadingComponents
        );
      }
      setTimeout(() => this.waitUntilAllComopnentsAreReady(cb, counter), 250);
    } else {
      if (cb instanceof Function) cb();
    }
  }
  addSerializedConnection(conn) {
    // console.log("## adding serialized connection", conn);
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
    // console.log("## adding serialized component",  comp);
    if (!comp) {
      return console.log("trying to add a null serialized component??");
    }
    if (comp.type == "Output" || comp.id == "output") return; //console.warn("YOU CANT CREATE OUTPUT COMPONENTS");
    let c = eval(comp.constructor);
    this.components.push(new c(this, comp));
  }

  deepSaveAllComponents() {
    for (let comp of this.components) {
      comp.quickSave();
    }
  }

  save(name) {
    if (!name) {
      name = prompt(
        "name the instrument, it will be saved in localStorage and in firebase"
      );
    }
    if (!name) return;
    this.patchName = name;
    let serialized = this.serialize();
    localStorage[this.SAVE_PREFIX + name] = JSON.stringify(serialized);
    this.deepSaveAllComponents();
    this.saveListOfComponentsInFirestore();
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
    if (!localStorage[this.SAVE_PREFIX + name])
      return console.warn("Couldn't find");
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
  // unsubscribeFromFirestore() {
  //   if (this.functionToUnsubscribeFromFirestore instanceof Function) {
  //     this.functionToUnsubscribeFromFirestore();
  //   }
  //   this.listeningToFirestore = false;
  // }

  async saveListOfComponentsInFirestore() {
    if (!this.patchName) return;
    //I STOP THE LISTENING, SAVE, AND START LISTENING AGAIN
    // this.unsubscribeFromFirestore();
    let serializedOutputComponent = this.getOutputComponent().serialize();
    let listOfSerializedComponents = this.components
      .filter((k) => k.id != "output")
      .map((k) => k.id);

    // console.log("# SAVING LIST OF COMPONENTS", listOfSerializedComponents);
    //I'M SAVING THE SESSION ID, WHICH IS A RANDOM VALUE EACH TIME YOU OPEN THE APP
    //AND THE USER ID THAT STAYS THE SAME, SAVED IN THE LOCALSTORAGE.
    //THE IDEA IS THAT IF IT'S YOUR CHANGES, AND YOU DID THEM NOW, THIS FRONTEND
    //SHOULD NOT UPDATE ANYTHING
    //IF IT'S YOUR OWN CHANGES FROM A PREVIOUS SESSION, GO AHEAD AND UPDATE
    await saveInFireStore(
      {
        bpm: this.bpm,
        components: listOfSerializedComponents,
        outputX: serializedOutputComponent.x,
        outputY: serializedOutputComponent.y,
        sessionID: this.sessionID,
        userID: this.userID,
      },
      this.patchName
    );
    // setTimeout(() => this.startListeningToFirestoreChanges(), 1000);
  }
}
