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
    document.querySelector(".patchName").innerHTML = this.patchName;
    this.admin = !!getParameterByName("admin");

    this.playButton = document.querySelector(".play");

    this.components = [];
    this.actx = new AudioContext();
    this.actx.suspend();

    this.bpm = 100;
    this.scale = 1;
    this.lastScale = 1;
    this.bulkLoading = false;
    this._workletModules = {};
    this.createMainContainer(elem);
    this.createMessageBox();
    this.createOutputComponent();
    this.createCanvasOnTop();
    this.addEventsToDropFile();

    this.putBPMInButton();

    this.generateUserAndSessionIDs();
    this.createInstanceOfRTCConnectionForUsers();

    document.addEventListener("contextmenu", (event) => event.preventDefault());

    window.onbeforeunload = (e) => {
      e.preventDefault();
      e.returnValue = true;
      removeMeAsUserInThisPatchInFirebase(this.patchName, this.userID);
    };

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
        } else if (e.key == " ") {
          this.buttonsContainer.classList.toggle("visible");
        }
      },
      false
    );

    this.wheelZoom();

    this.buttonsContainer = document.querySelector(".buttons");

    this.listOfConnectedUsersElement = document.querySelector("connectedUsers");

    // this.checkIfTheresAPatchToOpenInTheURL();
    setTimeout(() => this.startListeningToFirestoreChanges(), 1000);
  }

  createInstanceOfRTCConnectionForUsers() {
    this.rtcInstance = new RTCForUsersData(this);
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
    addMeAsUserInThisPatchInFirebase(this.patchName, this.userID, this.admin);
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
        try {
          this.loadedJSON = JSON.parse(reader.result);
          this.loadFromFile(this.loadedJSON);
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

      //LISTEN TO CHANGES IN THE USERS COLLECTIONS
      listenToChangesInUsersConnectedToThisPatch(this.patchName, (users) => {
        this.handleChangesInUsers(users);
      });
    });
  }
  handleChangesInUsers(users) {
    this.connectedUsers = users;
    //UPDATE HTML
    this.listOfConnectedUsersElement.innerHTML =
      users.length +
      (users.length > 1 ? " users online" : " user online") +
      (this.admin ? " (you're the admin)" : "");

    //CONNECT VIA RTC
    if (this.rtcInstance && this.rtcInstance.state == "ready") {
      if (!this.admin) {
        let adminsID = this.connectedUsers.filter((k) => k.admin)[0];
        if (!adminsID) return console.warn("there's no admin connected?");
        this.rtcInstance.connect(adminsID.userID);
      }
    }
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
      let oldS = this.scale;
      let newS = Math.min(Math.max(oldS - event.deltaY * 0.0005, 0.25), 1);
      if (newS === oldS) return;

      let box = this.container.getBoundingClientRect();
      let localX = (event.clientX - box.left) / oldS;
      let localY = (event.clientY - box.top) / oldS;

      this.scale = newS;
      this.lastScale = newS;
      this.container.style.transformOrigin = "0 0";
      this.container.style.transform = "scale(" + newS + ")";
      this.container.style.zoom = "";

      let parent = this.container.offsetParent.getBoundingClientRect();
      let left = event.clientX - parent.left - localX * newS;
      let top = event.clientY - parent.top - localY * newS;
      this.container.style.left = left + "px";
      this.container.style.top = top + "px";
      this.putCSSVariablesInMainContainer(left, top);
      this.container.parentNode.style.setProperty("--scale", this.scale);
      this.updateAllLines();

      this.container.parentNode.classList.add("zooming");
      clearTimeout(this.wheelTimeoutVar);
      this.wheelTimeoutVar = setTimeout(() => {
        this.container.parentNode.classList.remove("zooming");
        this.updateAllLines();
      }, 50);
    };
  }
  putBPMInButton() {
    (document.querySelector("#bpmButton") || {}).innerHTML =
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
    if (!from || !to) return;
    this.ctx.beginPath();
    let box = this.container.getBoundingClientRect();
    let fromBox = from.getBoundingClientRect();
    let toBox = to.getBoundingClientRect();
    let s = this.scale || 1;

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = color || "red";
    let startX = (fromBox.left + fromBox.width / 2 - box.left) / s;
    let startY = (fromBox.top + fromBox.height / 2 - box.top) / s;
    this.ctx.moveTo(startX, startY);

    let endX = (toBox.left + toBox.width / 2 - box.left) / s;
    let endY = (toBox.top + toBox.height / 2 - box.top) / s;

    this.ctx.bezierCurveTo(endX, startY, startX, endY, endX, endY);
    this.ctx.stroke();
  }

  loadWorklet(url) {
    if (!this._workletModules[url]) {
      this._workletModules[url] = this.actx.audioWorklet.addModule(url);
    }
    return this._workletModules[url];
  }

  getNextBeat() {
    let bpm = this.bpm || 120;
    let durationOf4Beats = (60 / bpm) * 4;
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
    this.container.draggable = false;
    this.container.style.transformOrigin = "0 0";
    this.container.style.transform = "scale(1)";
    this.container.style.zoom = "";

    elem.appendChild(this.container);
    this.SAVE_PREFIX = "modular_synth_";

    this.container.addEventListener("pointerdown", (e) => {
      if (e.button != 0) return;
      if (e.target != this.container && e.target != this.canvas) return;
      this.makeAllComponentsInactive();
      if (this.buttonsContainer) this.buttonsContainer.classList.remove("visible");
      this._panning = true;
      this._panStartX = e.clientX;
      this._panStartY = e.clientY;
      this._panLeft = parseFloat(getComputedStyle(this.container).left) || 0;
      this._panTop = parseFloat(getComputedStyle(this.container).top) || 0;
      this.container.setPointerCapture(e.pointerId);
    });

    this.container.addEventListener("pointermove", (e) => {
      if (!this._panning) return;
      // origin 0 0: left/top already match viewport px; /scale made zoom-out pan fly
      let x = this._panLeft + (e.clientX - this._panStartX);
      let y = this._panTop + (e.clientY - this._panStartY);
      this.container.style.left = x + "px";
      this.container.style.top = y + "px";
      this.putCSSVariablesInMainContainer(x, y);
      this.updateAllLines();
    });

    this.container.addEventListener("pointerup", () => {
      this._panning = false;
    });
    this.container.addEventListener("pointercancel", () => {
      this._panning = false;
    });

    this.container.onmousedown = () => {
      if (this.buttonsContainer) this.buttonsContainer.classList.remove("visible");
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
    if (this._linesRaf) return;
    this._linesRaf = requestAnimationFrame(() => {
      this._linesRaf = 0;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let c of this.getAllConnections()) {
        c.redraw();
      }
    });
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
  addRackCover() {
    this.components.push(new RackCover(this));
  }

  addConstantValueNode() {
    this.components.push(new ConstantValueNode(this));
  }
  addOscillator() {
    this.components.push(new Oscillator(this));
  }
  addDrawer() {
    this.components.push(new Drawer(this));
  }
  addPitchDetector() {
    this.components.push(new PitchDetectorComponent(this));
  }
  addPadSampler() {
    this.components.push(new PadSampler(this));
  }
  addSpectrum2Image() {
    this.components.push(new Spectrum2Image(this));
  }

  addSpectrogram() {
    this.components.push(new Spectrogram(this));
  }

  addPitchDetector2() {
    this.components.push(new PitchDetector2(this));
  }
  // addBPMDetector() {
  //   this.components.push(new BPMDetector(this));
  //
  // }
  addLerpComponent() {
    this.components.push(new LerpComponent(this));
  }

  addWebcamPlayer() {
    this.components.push(new WebcamPlayer(this));
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
  }

  addRTCSender() {
    this.components.push(new WebRTCSender(this));
  }

  addMic() {
    this.components.push(new Mic(this));
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
  addLargeVisualizer() {
    this.components.push(new LargeVisualizer(this));
  }
  addOscilloscope() {
    this.components.push(new Oscilloscope(this));
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
    for (let conn of this.getAllConnections()) {
      obj.connections.push(conn.serialize());
    }
    return obj;
  }

  loadFromFile(obj) {
    this.bulkLoading = true;
    if (obj.bpm) this.bpm = obj.bpm;
    this.putBPMInButton();

    for (let c of this.components.slice()) {
      if (c instanceof Output) continue;
      c.remove();
    }
    this.updatePositionOfOutPutComponent(obj);

    for (let comp of obj.components || []) {
      this.addSerializedComponent(comp);
    }

    this.whenAllComponentsReady().then(() => {
      this.applySerializedConnections(obj);
      this.bulkLoading = false;
      this.updateAllLines();
    });
  }

  applySerializedConnections(obj) {
    let conns = [];
    if (Array.isArray(obj.connections)) {
      for (let c of obj.connections) conns.push(c);
    }
    for (let comp of obj.components || []) {
      if (!Array.isArray(comp.connections)) continue;
      for (let c of comp.connections) conns.push(c);
    }
    for (let conn of conns) {
      this.addSerializedConnection(conn);
    }
  }

  async loadSamplePatch(path) {
    if (!path) return;
    try {
      let res = await fetch(path);
      this.loadFromFile(await res.json());
    } catch (e) {
      console.warn("could not load sample patch", path, e);
    }
    let sel = document.getElementById("samplePatchSelect");
    if (sel) sel.value = "";
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

  whenAllComponentsReady() {
    return new Promise((resolve) => {
      let tries = 0;
      const tick = () => {
        let notReady = this.components.filter((k) => !k.amIReady());
        if (notReady.length === 0) {
          resolve();
          return;
        }
        tries++;
        if (tries > 200) {
          console.warn(
            "components didn't load :(",
            notReady.map((k) => k.type + ":" + k.id)
          );
          resolve();
          return;
        }
        setTimeout(tick, 25);
      };
      tick();
    });
  }

  waitUntilAllComopnentsAreReady(cb) {
    this.whenAllComponentsReady().then(() => {
      if (cb instanceof Function) cb();
    });
  }

  addSerializedConnection(conn) {
    if (!conn) return;
    let from = this.getComponentByID(conn.from);
    let to = this.getComponentByID(conn.to);
    if (from && to) {
      from.connect(to, conn.audioParam, parseInt(conn.numberOfOutput));
    } else {
      console.warn("Couldn't find the components", conn);
    }
  }
  addSerializedComponent(comp) {
    if (!comp) {
      return console.log("trying to add a null serialized component??");
    }
    if (comp.type == "Output" || comp.id == "output") return;
    let Ctor = App.COMPONENT_CLASSES[comp.constructor];
    if (!Ctor) {
      console.warn("Unknown component constructor", comp.constructor);
      return;
    }
    this.components.push(new Ctor(this, comp));
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
  }

  play() {
    if (this.actx.state == "running") {
      if (this.admin) {
        this.rtcInstance.sendMessage({ action: "stop" });
      }
      this.actx.suspend();
      this.playButton.innerHTML = " ▶ ";
    } else {
      if (this.admin) {
        this.rtcInstance.sendMessage({ action: "play" });
      }
      this.actx.resume();
      this.playButton.innerHTML = " ■ ";
    }
  }

  openButtons() {
    this.buttonsContainer.classList.toggle("visible");
  }
}

App.COMPONENT_CLASSES = {
  Oscillator,
  Amp,
  Gain: Amp,
  Filter,
  Delay,
  Compressor,
  Reverb,
  Distortion,
  NoiseGenWithWorklet,
  CustomProcessorComponent,
  Sequencer,
  EnvelopeGenerator,
  ConstantValueNode,
  Mouse,
  KeyboardComponent,
  JoystickComponent,
  Midi,
  MidiFilePlayer,
  AudioPlayer,
  Mic,
  ImagePlayerWorkletVersion,
  WebcamPlayer,
  Oscilloscope,
  Merger,
  Multiplexor,
  LerpComponent,
  CounterComponent,
  MemoryComponent,
  PeakDetectorComponent,
  PitchDetectorComponent,
  NumberDisplayComponent,
  BPMOutputComponent,
  Text,
  RackCover,
  Drawer,
  PadSampler,
  WaveShaper,
  FrequencyAnalizer,
  Spectrogram,
  LargeVisualizer,
  Spectrum2Image,
  ImageMaker,
  WebRTCSender,
  WebRTCReceiver,
  Output,
};
