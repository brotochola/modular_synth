class App {
  static HISTORY_CAP = 40;
  static CABLE_DEFAULTS = {
    gravity: 1800,
    stiffness: 400,
    damping: 0.92,
    slack: 1.25,
    beadRadius: 3.5,
  };
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
    this.cables = Object.assign({}, App.CABLE_DEFAULTS);
    this.scale = 1;
    this.lastScale = 1;
    this.bulkLoading = false;
    this.restoringHistory = false;
    this.syncingRemote = false;
    this.history = [];
    this.historyIndex = 0;
    this._loadGen = 0;
    this._workletModules = {};
    this.remoteCursors = {};
    this._lastCursorSentAt = 0;
    this._cablesDirty = true;
    this._cableMouse = { x: 0, y: 0 };
    this._cableMouseClient = { x: 0, y: 0 };
    this.createMainContainer(elem);
    this.createMessageBox();
    this.createOutputComponent();
    this.createCanvasOnTop();
    this.initCableWorld();
    this.addEventsToDropFile();
    this.initHistory();

    this.putBPMInButton();

    this.generateUserAndSessionIDs();
    this.createInstanceOfRTCConnectionForUsers();
    this.bindRemotePresenceHandlers();
    this.bindLocalCursorBroadcast();

    document.addEventListener("contextmenu", (event) => event.preventDefault());

    window.onbeforeunload = (e) => {
      e.preventDefault();
      e.returnValue = true;
      removeMeAsUserInThisPatchInFirebase(this.patchName, this.userID);
    };

    window.addEventListener(
      "keydown",
      (e) => {
        let typing = App.isTypingTarget(e.target);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "z") {
          if (typing) return;
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "y") {
          if (typing) return;
          e.preventDefault();
          this.redo();
          return;
        }
        if (e.key == "Escape") {
          this.clearCableGhost();
          return;
        }
        if (e.key == "Delete") {
          if (typing) return;
          for (let c of this.components.filter((k) => k.active)) {
            c.remove();
            this.saveListOfComponentsInFirestore();
            break;
          }

          this.updateAllLines();
        } else if (e.key == " ") {
          if (typing) return;
          this.buttonsContainer.classList.toggle("visible");
          if (this.historyPanel) this.historyPanel.classList.remove("visible");
          if (this.cablePanel) this.cablePanel.classList.remove("visible");
        }
      },
      false,
    );

    this.wheelZoom();

    this.buttonsContainer = document.querySelector(".buttons");
    this.bindCablePanel();

    this.listOfConnectedUsersElement = document.querySelector("connectedUsers");

    // this.checkIfTheresAPatchToOpenInTheURL();
    setTimeout(() => this.startListeningToFirestoreChanges(), 1000);
  }

  spaceOutComponents(numPx) {
    Array.from(document.querySelectorAll("component")).map((k) => {
      k.style.left = parseInt(k.style.left) * numPx + "px";
      k.style.top = parseInt(k.style.top) * numPx + "px";
    });
    this.updateAllLines();
  }
  createInstanceOfRTCConnectionForUsers() {
    this.rtcInstance = new RTCForUsersData(this);
  }

  bindRemotePresenceHandlers() {
    this.onRemoteCursor = (msg) => this.applyRemoteCursor(msg);
    this.onRemoteDrag = (msg) => this.applyRemoteDrag(msg, false);
    this.onRemoteDragEnd = (msg) => this.applyRemoteDrag(msg, true);
  }

  bindLocalCursorBroadcast() {
    window.addEventListener("pointermove", (e) => {
      this.broadcastLocalCursor(e);
    });
    setInterval(() => this.pruneStaleRemoteCursors(), 1000);
  }

  clientToRackCoords(clientX, clientY) {
    let s = this.scale || 1;
    let rack = this.container.getBoundingClientRect();
    return {
      x: (clientX - rack.left) / s,
      y: (clientY - rack.top) / s,
    };
  }

  broadcastLocalCursor(e) {
    if (!this.rtcInstance) return;
    let now = performance.now();
    if (now - this._lastCursorSentAt < 66) return;
    this._lastCursorSentAt = now;
    let { x, y } = this.clientToRackCoords(e.clientX, e.clientY);
    this.rtcInstance.sendMessage({
      type: "cursor",
      userID: this.userID,
      x,
      y,
    });
  }

  hueFromUserId(userID) {
    let h = 0;
    let s = String(userID || "");
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  ensureRemoteCursor(userID) {
    if (!userID || userID == this.userID) return null;
    let entry = this.remoteCursors[userID];
    if (entry) return entry;
    let el = document.createElement("div");
    el.className = "remote-cursor";
    el.style.setProperty("--cursor-hue", this.hueFromUserId(userID));
    let label = document.createElement("span");
    label.className = "remote-cursor-label";
    label.textContent = userID;
    el.appendChild(label);
    this.container.appendChild(el);
    entry = { el, lastSeen: performance.now() };
    this.remoteCursors[userID] = entry;
    return entry;
  }

  applyRemoteCursor(msg) {
    if (!msg || msg.userID == null || msg.x == null || msg.y == null) return;
    let entry = this.ensureRemoteCursor(msg.userID);
    if (!entry) return;
    entry.el.style.left = msg.x + "px";
    entry.el.style.top = msg.y + "px";
    entry.lastSeen = performance.now();
  }

  applyRemoteDrag(msg, isEnd) {
    if (!msg || !msg.componentId || msg.x == null || msg.y == null) return;
    let compo = this.getComponentByID(msg.componentId);
    if (!compo || !compo.container) return;
    this.syncingRemote = true;
    let x = typeof msg.x == "number" ? msg.x + "px" : msg.x;
    let y = typeof msg.y == "number" ? msg.y + "px" : msg.y;
    compo.container.style.left = x;
    compo.container.style.top = y;
    compo.container.style.setProperty("--posX", x);
    compo.container.style.setProperty("--posY", y);
    this.updateAllLines();
    this.syncingRemote = false;
    if (msg.userID) {
      let entry = this.ensureRemoteCursor(msg.userID);
      if (entry) entry.lastSeen = performance.now();
    }
  }

  removeRemoteCursor(userID) {
    let entry = this.remoteCursors[userID];
    if (!entry) return;
    if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    delete this.remoteCursors[userID];
  }

  pruneStaleRemoteCursors() {
    let now = performance.now();
    for (let userID of Object.keys(this.remoteCursors)) {
      if (now - this.remoteCursors[userID].lastSeen > 3000) {
        this.removeRemoteCursor(userID);
      }
    }
  }

  syncRtcMesh(users) {
    if (!this.rtcInstance) return;
    let online = new Set();
    for (let u of users || []) {
      if (!u || !u.userID || u.userID == this.userID) continue;
      online.add(u.userID);
      this.rtcInstance.connect(u.userID);
    }
    for (let peerId of this.rtcInstance.listPeerIds()) {
      if (!online.has(peerId)) {
        this.rtcInstance.disconnect(peerId);
      }
    }
    for (let userID of Object.keys(this.remoteCursors)) {
      if (!online.has(userID)) this.removeRemoteCursor(userID);
    }
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
      delay,
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

  async startListeningToFirestoreChanges() {
    if (!this.patchName) return;
    if (this.listeningToFirestore) return;
    this.listeningToFirestore = true;

    let loaded = await getDocFromFirebase(this.patchName);
    if (loaded) {
      this.loadFromFile(loaded);
      await this.whenAllComponentsReady();
    }

    this.functionToUnsubscribeFromFirestore = listenToChangesInWholePatch(
      this.patchName,
      (e) => {
        console.log("#!!! changes", e);
        this.lastChangedFromFirestore = e;
        this.handleChangesInThisPatchFromFirestore(e);
      },
      this.sesstionID,
      this.userID,
    );

    listenToChangesInUsersConnectedToThisPatch(this.patchName, (users) => {
      this.handleChangesInUsers(users);
    });
  }
  handleChangesInUsers(users) {
    this.connectedUsers = users;
    //UPDATE HTML
    this.listOfConnectedUsersElement.innerHTML =
      users.length +
      (users.length > 1 ? " users online" : " user online") +
      (this.admin ? " (you're the admin)" : "");

    this.syncRtcMesh(users);
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
    if (this.bulkLoading || this.restoringHistory) return;
    if (e.sessionID == this.sessionID && e.userID == this.userID) {
      return; // console.warn("THESEA RE YOUR OWN CHANGES");
    }
    this.syncingRemote = true;
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
                this.syncingRemote = true;
                this.addSerializedComponent(serializedComponent);
                this.waitUntilAllComopnentsAreReady(() => {
                  this.syncingRemote = false;
                  this.resetHistory();
                });
              }
            },
          );
        }
      }

      //CHECK IF I GOTTA REMOVE SOME COMPONENT FROM THIS FRONTEND:

      let componentsWeHaveToRemove = this.components.filter(
        (k) => !e.components.includes(k.id),
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
    if (e.cables) this.applyCableParams(e.cables);

    this.updateAllLines();
    this.waitUntilAllComopnentsAreReady(() => {
      this.syncingRemote = false;
      this.resetHistory();
    });
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
    this.appEl.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.sizeCableCanvas();
    window.addEventListener("resize", () => {
      this.sizeCableCanvas();
      this.markCablesDirty();
    });
  }
  initCableWorld() {
    this.cableWorld = new CableWorld();
    this.cableWorld.setParams(this.cables);
    this._cableLastTs = 0;
    window.addEventListener("pointermove", (e) => {
      this._cableMouseClient.x = e.clientX;
      this._cableMouseClient.y = e.clientY;
    });
    this.startCableLoop();
  }
  startCableLoop() {
    let tick = (ts) => {
      this._cableRaf = requestAnimationFrame(tick);
      let dt = this._cableLastTs ? (ts - this._cableLastTs) / 1000 : 0.016;
      this._cableLastTs = ts;
      this.runCableFrame(dt);
    };
    this._cableRaf = requestAnimationFrame(tick);
  }
  sizeCableCanvas() {
    let w = this.appEl.clientWidth;
    let h = this.appEl.clientHeight;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = 3;
  }
  jackCenterWorld(el) {
    if (!el) return null;
    let rack = this.container.getBoundingClientRect();
    let s = this.scale || 1;
    let box = el.getBoundingClientRect();
    let cx = box.left + box.width / 2;
    let cy = box.top + box.height / 2;
    return {
      x: (cx - rack.left) / s,
      y: (cy - rack.top) / s,
    };
  }
  clientToWorld(clientX, clientY) {
    let rack = this.container.getBoundingClientRect();
    let s = this.scale || 1;
    return {
      x: (clientX - rack.left) / s,
      y: (clientY - rack.top) / s,
    };
  }
  markCablesDirty() {
    this._cablesDirty = true;
  }
  connectionCableColor(conn) {
    return (
      conn.from.type +
      conn.to.type +
      conn.audioParam +
      conn.numberOfOutput
    ).toRGB();
  }
  connectionJackEls(conn) {
    let fromEl = conn.from.outputs.querySelector(
      '.outputButton[numberOfOutput="' + conn.numberOfOutput + '"]',
    );
    let toEl = (conn.to.inputElements[conn.audioParam] || {}).button;
    return { fromEl, toEl };
  }
  syncPhysicsCables() {
    if (!this.cableWorld) return;
    let conns = this.getAllConnections();
    let live = new Set();
    for (let conn of conns) {
      live.add(conn.id);
      let { fromEl, toEl } = this.connectionJackEls(conn);
      if (!fromEl || !toEl) continue;
      let a = this.jackCenterWorld(fromEl);
      let b = this.jackCenterWorld(toEl);
      if (!a || !b) continue;
      let slot = this.cableWorld.byConnectionId.get(conn.id);
      if (slot == null) {
        this.cableWorld.createCable({
          x0: a.x,
          y0: a.y,
          x1: b.x,
          y1: b.y,
          fromEl,
          toEl,
          connectionId: conn.id,
          color: this.connectionCableColor(conn),
        });
      } else {
        let cab = this.cableWorld.cables[slot];
        if (cab) {
          cab.fromEl = fromEl;
          cab.toEl = toEl;
          cab.color = this.connectionCableColor(conn);
        }
        this.cableWorld.setEndpoints(slot, a.x, a.y, b.x, b.y, true);
      }
    }
    for (let [connId] of [...this.cableWorld.byConnectionId.entries()]) {
      if (!live.has(connId)) this.cableWorld.freeByConnectionId(connId);
    }
    this._cablesDirty = false;
  }
  syncCableGhost() {
    if (!this.cableWorld) return;
    if (!this.lastOutputClicked || !this.lastOutputClicked.output) {
      this.cableWorld.clearGhost();
      return;
    }
    let fromEl = this.lastOutputClicked.output;
    let a = this.jackCenterWorld(fromEl);
    let m = this.clientToWorld(
      this._cableMouseClient.x,
      this._cableMouseClient.y,
    );
    if (!a) return;
    this.cableWorld.ensureGhost(fromEl, a.x, a.y, m.x, m.y);
    if (this.cableWorld.ghostSlot >= 0) {
      this.cableWorld.setEndpoints(
        this.cableWorld.ghostSlot,
        a.x,
        a.y,
        m.x,
        m.y,
        true,
      );
    }
  }
  clearCableGhost() {
    this.lastOutputClicked = null;
    if (this.cableWorld) this.cableWorld.clearGhost();
  }
  runCableFrame(dt) {
    if (!this.cableWorld || !this.ctx) return;
    this.sizeCableCanvas();
    this.cableWorld.setParams(this.cables);
    this.syncPhysicsCables();
    this.syncCableGhost();
    this.cableWorld.step(dt);

    let ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let rack = this.container.getBoundingClientRect();
    let canvasBox = this.canvas.getBoundingClientRect();
    let s = this.scale || 1;
    ctx.setTransform(
      s,
      0,
      0,
      s,
      rack.left - canvasBox.left,
      rack.top - canvasBox.top,
    );
    this.cableWorld.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  drawLine() {
    this.markCablesDirty();
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
    this.appEl = elem;
    this.container = document.createElement("div");
    this.container.classList.add("mainContainer");
    this.container.draggable = false;
    this.container.style.transformOrigin = "0 0";
    this.container.style.transform = "scale(1)";
    this.container.style.zoom = "";

    elem.appendChild(this.container);
    this.SAVE_PREFIX = "modular_synth_";

    elem.addEventListener("pointerdown", (e) => {
      if (e.button != 0) return;
      if (
        e.target.closest(
          "component, footer, .buttons, .historyPanel, .messageBox",
        )
      )
        return;
      this.makeAllComponentsInactive();
      this.clearCableGhost();
      if (this.buttonsContainer)
        this.buttonsContainer.classList.remove("visible");
      if (this.cablePanel) this.cablePanel.classList.remove("visible");
      this._panning = true;
      this._panStartX = e.clientX;
      this._panStartY = e.clientY;
      this._panLeft = parseFloat(getComputedStyle(this.container).left) || 0;
      this._panTop = parseFloat(getComputedStyle(this.container).top) || 0;
      elem.setPointerCapture(e.pointerId);
    });

    elem.addEventListener("pointermove", (e) => {
      if (!this._panning) return;
      // origin 0 0: left/top already match viewport px; /scale made zoom-out pan fly
      let x = this._panLeft + (e.clientX - this._panStartX);
      let y = this._panTop + (e.clientY - this._panStartY);
      this.container.style.left = x + "px";
      this.container.style.top = y + "px";
      this.putCSSVariablesInMainContainer(x, y);
      this.updateAllLines();
    });

    elem.addEventListener("pointerup", () => {
      this._panning = false;
    });
    elem.addEventListener("pointercancel", () => {
      this._panning = false;
    });

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
    this.markCablesDirty();
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
  addMixer() {
    this.components.push(new Mixer(this));
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
  addShader() {
    this.components.push(new Shader(this));
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
      }),
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
      }),
    );
  }

  removeAllConnections(compo) {
    // debugger
    this.components.map((k) =>
      k.connections.map((c) => {
        if (c.to == compo || c.from == compo) {
          c.remove();
        }
      }),
    );
  }

  serialize() {
    let serializedOutputComponent = this.getOutputComponent().serialize();
    let obj = {
      components: [],
      connections: [],
      bpm: this.bpm,
      cables: Object.assign({}, this.cables),
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

  loadFromFile(obj, fromHistory) {
    if (!obj) return;
    if ((this.bulkLoading || this.restoringHistory) && !fromHistory) return;
    this._loadGen++;
    let gen = this._loadGen;
    this.bulkLoading = true;
    if (obj.bpm) this.bpm = obj.bpm;
    this.putBPMInButton();
    this.applyCableParams(obj.cables);

    for (let c of this.components.slice()) {
      if (c instanceof Output) continue;
      c.remove();
    }
    this.updatePositionOfOutPutComponent(obj);

    for (let comp of obj.components || []) {
      this.addSerializedComponent(comp);
    }

    this.whenAllComponentsReady().then(() => {
      if (gen != this._loadGen) return;
      this.applySerializedConnections(obj);
      this.updateAllLines();
      if (fromHistory) {
        if (this.history[this.historyIndex]) {
          this.history[this.historyIndex].snap = this.clonePatch(
            this.serialize(),
          );
        }
        this.saveListOfComponentsInFirestore();
      } else {
        this.pushHistoryEntry("Load patch", this.clonePatch(this.serialize()));
      }
      setTimeout(() => {
        this.bulkLoading = false;
        this.restoringHistory = false;
        this.renderHistoryPanel();
      }, 0);
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
            notReady.map((k) => k.type + ":" + k.id),
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
    return Promise.all(
      this.components
        .filter((c) => c.id != "output")
        .map((c) => c.quickSave()),
    );
  }

  save(name) {
    if (!name) {
      name = prompt(
        "name the instrument, it will be saved in localStorage and in firebase",
      );
    }
    if (!name) return;
    this.patchName = name;
    let serialized = this.serialize();
    localStorage[this.SAVE_PREFIX + name] = JSON.stringify(serialized);
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
    this.afterEdit();
  }

  download() {
    downloader(
      JSON.stringify(this.serialize()),
      "application/json",
      "my_patch.json",
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
    if (this._savingPatch) return;
    this._savingPatch = true;
    try {
      await this.deepSaveAllComponents();
      let serializedOutputComponent = this.getOutputComponent().serialize();
      let listOfSerializedComponents = this.components
        .filter((k) => k.id != "output")
        .map((k) => k.id);

      await saveInFireStore(
        {
          bpm: this.bpm,
          cables: Object.assign({}, this.cables),
          components: listOfSerializedComponents,
          outputX: serializedOutputComponent.x,
          outputY: serializedOutputComponent.y,
          sessionID: this.sessionID,
          userID: this.userID,
        },
        this.patchName,
      );
    } finally {
      this._savingPatch = false;
    }
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
    if (this.historyPanel) this.historyPanel.classList.remove("visible");
    if (this.cablePanel) this.cablePanel.classList.remove("visible");
  }

  openHistory() {
    if (!this.historyPanel) return;
    this.historyPanel.classList.toggle("visible");
    if (this.historyPanel.classList.contains("visible")) {
      if (this.buttonsContainer)
        this.buttonsContainer.classList.remove("visible");
      if (this.cablePanel) this.cablePanel.classList.remove("visible");
      this.renderHistoryPanel();
    }
  }

  openCables() {
    if (!this.cablePanel) return;
    this.cablePanel.classList.toggle("visible");
    if (this.cablePanel.classList.contains("visible")) {
      if (this.buttonsContainer)
        this.buttonsContainer.classList.remove("visible");
      if (this.historyPanel) this.historyPanel.classList.remove("visible");
    }
  }

  applyCableParams(cables) {
    let d = App.CABLE_DEFAULTS;
    let src = cables || {};
    let num = (v, fallback) => {
      v = parseFloat(v);
      return isNaN(v) ? fallback : v;
    };
    this.cables = {
      gravity: num(src.gravity, d.gravity),
      stiffness: num(src.stiffness, d.stiffness),
      damping: num(src.damping, d.damping),
      slack: num(src.slack, d.slack),
      beadRadius: num(src.beadRadius, d.beadRadius),
    };
    if (this.cableWorld) this.cableWorld.setParams(this.cables);
    this.syncCableSliders();
    this.updateAllLines();
  }

  syncCableSliders() {
    if (!this.cablePanel) return;
    for (let key of Object.keys(this.cables)) {
      let input = this.cablePanel.querySelector('[name="' + key + '"]');
      if (input) input.value = this.cables[key];
      let out = this.cablePanel.querySelector('[data-val="' + key + '"]');
      if (out) out.textContent = input ? input.value : this.cables[key];
    }
  }

  bindCablePanel() {
    this.cablePanel = document.querySelector(".cablePanel");
    if (!this.cablePanel) return;
    this.cablePanel.addEventListener("input", (e) => {
      let name = e.target.name;
      if (!name || !(name in this.cables)) return;
      let v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      this.cables[name] = v;
      let out = this.cablePanel.querySelector('[data-val="' + name + '"]');
      if (out) out.textContent = e.target.value;
      this.updateAllLines();
    });
    this.cablePanel.addEventListener("change", (e) => {
      if (!e.target.name || !(e.target.name in this.cables)) return;
      this.saveListOfComponentsInFirestore();
      this.afterEdit();
    });
    this.syncCableSliders();
  }

  static isTypingTarget(el) {
    if (!el) return false;
    let tag = (el.tagName || "").toLowerCase();
    return (
      tag == "input" ||
      tag == "textarea" ||
      tag == "select" ||
      el.isContentEditable
    );
  }

  clonePatch(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  snapsEqual(a, b) {
    return JSON.stringify(a) == JSON.stringify(b);
  }

  initHistory() {
    this.historyPanel = document.querySelector(".historyPanel");
    this.historyList = document.querySelector(".historyList");
    this.undoButton = document.querySelector(".undo");
    this.redoButton = document.querySelector(".redo");
    this.history = [
      { label: "Start", snap: this.clonePatch(this.serialize()) },
    ];
    this.historyIndex = 0;
    this.renderHistoryPanel();
  }

  resetHistory() {
    this.history = [
      { label: "Start", snap: this.clonePatch(this.serialize()) },
    ];
    this.historyIndex = 0;
    this.renderHistoryPanel();
  }

  pushHistoryEntry(label, snap) {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push({ label: label || "Edit", snap });
    this.historyIndex = this.history.length - 1;
    // ponytail: cap 40 full-patch snapshots. Named commands if the list gets noisy.
    while (this.history.length > App.HISTORY_CAP) {
      this.history.shift();
      this.historyIndex--;
    }
    if (this.historyIndex < 0) this.historyIndex = 0;
    this.renderHistoryPanel();
  }

  afterEdit() {
    if (this.bulkLoading || this.restoringHistory || this.syncingRemote) return;
    if (!this.history.length) this.initHistory();
    let now = this.clonePatch(this.serialize());
    let current = this.history[this.historyIndex];
    if (current && this.snapsEqual(current.snap, now)) return;
    let label = current ? App.diffLabel(current.snap, now) : "Edit";
    this.pushHistoryEntry(label, now);
  }

  restoreHistoryIndex(i) {
    if (i < 0 || i >= this.history.length) return;
    if (this.bulkLoading || this.restoringHistory) return;
    if (i == this.historyIndex) return;
    this.historyIndex = i;
    this.restoringHistory = true;
    this.loadFromFile(this.history[i].snap, true);
    this.renderHistoryPanel();
  }

  undo() {
    this.restoreHistoryIndex(this.historyIndex - 1);
  }

  redo() {
    this.restoreHistoryIndex(this.historyIndex + 1);
  }

  jumpToHistory(i) {
    this.restoreHistoryIndex(i);
  }

  renderHistoryPanel() {
    if (this.undoButton) this.undoButton.disabled = this.historyIndex <= 0;
    if (this.redoButton) {
      this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
    }
    if (!this.historyList) return;
    this.historyList.innerHTML = "";
    for (let i = 0; i < this.history.length; i++) {
      let row = document.createElement("button");
      row.type = "button";
      row.classList.add("historyRow");
      if (i == this.historyIndex) row.classList.add("current");
      if (i > this.historyIndex) row.classList.add("future");
      row.textContent = this.history[i].label;
      row.onclick = () => this.jumpToHistory(i);
      this.historyList.appendChild(row);
    }
    let currentRow = this.historyList.querySelector(".historyRow.current");
    if (currentRow) currentRow.scrollIntoView({ block: "nearest" });
  }

  static patchTypeName(comp) {
    return String(
      (comp && (comp.type || comp.constructor)) || "module",
    ).replace(/Component$/, "");
  }

  static collectConns(obj) {
    let list = [];
    let seen = {};
    let add = (c) => {
      if (!c) return;
      let k = c.from + ">" + c.to + ":" + c.audioParam + "#" + c.numberOfOutput;
      if (seen[k]) return;
      seen[k] = true;
      list.push(c);
    };
    for (let c of (obj && obj.connections) || []) add(c);
    for (let comp of (obj && obj.components) || []) {
      for (let c of comp.connections || []) add(c);
    }
    return list;
  }

  static compsById(obj) {
    let map = {};
    for (let c of (obj && obj.components) || []) {
      if (c && c.id) map[c.id] = c;
    }
    return map;
  }

  static diffLabel(prev, now) {
    prev = prev || {};
    now = now || {};
    if (prev.bpm != now.bpm) return "BPM " + now.bpm;
    if (JSON.stringify(prev.cables || {}) != JSON.stringify(now.cables || {})) {
      return "Cables";
    }
    if (prev.outputX != now.outputX || prev.outputY != now.outputY) {
      return "Move Output";
    }
    let prevMap = App.compsById(prev);
    let nowMap = App.compsById(now);
    for (let id of Object.keys(nowMap)) {
      if (!prevMap[id]) return "Add " + App.patchTypeName(nowMap[id]);
    }
    for (let id of Object.keys(prevMap)) {
      if (!nowMap[id]) return "Delete " + App.patchTypeName(prevMap[id]);
    }
    let prevConns = App.collectConns(prev);
    let nowConns = App.collectConns(now);
    let prevKeys = {};
    for (let c of prevConns) {
      prevKeys[
        c.from + ">" + c.to + ":" + c.audioParam + "#" + c.numberOfOutput
      ] = c;
    }
    let nowKeys = {};
    for (let c of nowConns) {
      nowKeys[
        c.from + ">" + c.to + ":" + c.audioParam + "#" + c.numberOfOutput
      ] = c;
    }
    for (let k of Object.keys(nowKeys)) {
      if (!prevKeys[k]) {
        let c = nowKeys[k];
        let from = App.patchTypeName(nowMap[c.from] || prevMap[c.from]);
        let to = App.patchTypeName(nowMap[c.to] || prevMap[c.to]);
        return "Cable " + from + " → " + to + " " + c.audioParam;
      }
    }
    for (let k of Object.keys(prevKeys)) {
      if (!nowKeys[k]) {
        let c = prevKeys[k];
        let to = App.patchTypeName(prevMap[c.to] || nowMap[c.to]);
        return "Unplug " + to + " " + c.audioParam;
      }
    }
    for (let id of Object.keys(nowMap)) {
      let a = prevMap[id];
      let b = nowMap[id];
      if (!a) continue;
      let pa = a.audioParams || {};
      let pb = b.audioParams || {};
      let keys = Object.keys(pb);
      for (let key of keys) {
        if (pa[key] != pb[key]) {
          return App.patchTypeName(b) + " " + key;
        }
      }
      if (a.x != b.x || a.y != b.y) return "Move " + App.patchTypeName(b);
    }
    return "Edit";
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
  Mixer,
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
  Shader,
  WebRTCSender,
  WebRTCReceiver,
  Output,
};
