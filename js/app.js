class App {
  static HISTORY_CAP = 40;
  static CABLE_DEFAULTS = {
    gravity: 4000,
    stiffness: 0,
    damping: 0.88,
    slack: 0.5,
    beadRadius: 1.25,
    cableAlpha: 0.5,
  };
  // analog patch-cable set: saturated, similar lightness, readable on dark rack
  static CABLE_COLORS = [
    "#ef5350",
    "#ff8a65",
    "#ffca28",
    "#9ccc65",
    "#26a69a",
    "#42a5f5",
    "#7e57c2",
    "#ec407a",
    "#80deea",
    "#ffe082",
    "#ba68c8",
    "#ff7043",
  ];
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
    this.sysStatusEl = document.querySelector(".sysStatus");

    this.components = [];
    this.actx = new AudioContext();
    this.actx.suspend();
    this.actx.addEventListener("statechange", () => this.updateSysStatus());

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
    this.remoteInputs = {};
    this._lastCursorSentAt = 0;
    this._lastInputSentAt = {};
    this._lastLiveSentAt = 0;
    this._pendingLive = null;
    this._lastUserKey = "";
    this._remoteDragging = {};
    this._remoteDragAnim = {};
    this._prevSessions = null;
    this._prevSessionLabels = {};
    this.playing = false;
    this.beatOriginMs = null;
    this.clockOffsetMs = 0;
    this._clockOffsetSamples = [];
    this._timeSyncTimer = null;
    this._beatPublishTimer = null;
    this._cablesDirty = true;
    this._endpointDirtyIds = new Set();
    this._rackRect = null;
    this._rackScale = 1;
    this._sysFps = 60;
    this._sysFrameMs = 16;
    this._sysHudAt = 0;
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
    this.bindPresenceLifecycle();
    this.bindRemotePresenceHandlers();
    this.bindLocalCursorBroadcast();

    document.addEventListener("contextmenu", (event) => event.preventDefault());

    window.onbeforeunload = (e) => {
      this.leavePatchPresence();
      e.preventDefault();
      e.returnValue = true;
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
    this.populateSavedPatches();
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

  bindPresenceLifecycle() {
    this.writePresence();
    this._presenceHeartbeat = setInterval(
      () => this.writePresenceHeartbeat(),
      5000,
    );
    window.addEventListener("pagehide", () => this.leavePatchPresence());
  }

  writePresence() {
    if (!this.patchName) return;
    addMeAsUserInThisPatchInFirebase(this.patchName, {
      userID: this.userID,
      sessionID: this.sessionID,
      peerId: this.rtcInstance && this.rtcInstance.peerID,
      admin: this.admin,
    });
  }

  writePresenceHeartbeat() {
    if (!this.patchName || this._leftPresence) return;
    heartbeatMeInThisPatchInFirebase(this.patchName, this.sessionID, {
      peerId: this.rtcInstance && this.rtcInstance.peerID,
      userID: this.userID,
      admin: this.admin,
    });
  }

  leavePatchPresence() {
    if (this._leftPresence) return;
    this._leftPresence = true;
    if (this._presenceHeartbeat) clearInterval(this._presenceHeartbeat);
    if (this._timeSyncTimer) clearInterval(this._timeSyncTimer);
    this.stopBeatPublishLoop();
    removeMeAsUserInThisPatchInFirebase(this.patchName, this.sessionID);
    if (this.rtcInstance) this.rtcInstance.remove();
  }

  rotateSessionForPeer() {
    if (this._leftPresence) return;
    let old = this.sessionID;
    removeMeAsUserInThisPatchInFirebase(this.patchName, old);
    this.sessionID = makeid(12);
    if (this.rtcInstance) this.rtcInstance.startPeer();
    this.writePresence();
  }

  onPeerReady(id) {
    heartbeatMeInThisPatchInFirebase(this.patchName, this.sessionID, {
      peerId: id,
      userID: this.userID,
      admin: this.admin,
    });
  }

  onRtcPeerOpen() {
    this.startTimeSyncLoop();
    if (this.admin && this.playing) this.publishTransport(false);
    else this.refreshClockSkew();
  }

  hasOpenRtc() {
    return !!(this.rtcInstance && this.rtcInstance.hasOpenConnection());
  }

  adminNowMs() {
    return performance.now() + (this.clockOffsetMs || 0);
  }

  startTimeSyncLoop() {
    if (this.admin) return;
    if (this._timeSyncTimer) return;
    this._timeSyncTimer = setInterval(() => this.sendTimeSyncPing(), 2000);
    this.sendTimeSyncPing();
  }

  sendTimeSyncPing() {
    if (this.admin || !this.hasOpenRtc()) return;
    this._timeSyncT0 = performance.now();
    this.rtcInstance.sendMessage({
      type: "timeSync",
      t0: this._timeSyncT0,
      userID: this.userID,
      sessionID: this.sessionID,
    });
  }

  onTimeSyncReply(msg) {
    if (this.admin || msg.t0 == null || msg.t1 == null) return;
    let t3 = performance.now();
    let t0 = msg.t0;
    let rtt = t3 - t0;
    if (rtt < 0 || rtt > 2000) return;
    let offset = msg.t1 + rtt / 2 - t3;
    this._clockOffsetSamples.push({ offset, rtt });
    if (this._clockOffsetSamples.length > 8) this._clockOffsetSamples.shift();
    let sorted = this._clockOffsetSamples
      .slice()
      .sort((a, b) => a.rtt - b.rtt)
      .slice(0, Math.max(1, Math.ceil(this._clockOffsetSamples.length / 2)));
    let offsets = sorted.map((s) => s.offset).sort((a, b) => a - b);
    this.clockOffsetMs = offsets[Math.floor(offsets.length / 2)];
    this.refreshClockSkew();
  }

  refreshClockSkew() {
    if (this.beatOriginMs == null || !this.playing) {
      this.pushClockSkew(0);
      return;
    }
    let transportSec = (this.adminNowMs() - this.beatOriginMs) / 1000;
    let skew = transportSec - this.actx.currentTime;
    this.pushClockSkew(skew);
  }

  pushClockSkew(skew) {
    this.clockSkew = skew || 0;
    for (let c of this.components || []) {
      if (c && c.applyClockSkew instanceof Function)
        c.applyClockSkew(this.clockSkew);
    }
  }

  computeBeatOriginMs() {
    return this.adminNowMs() - this.actx.currentTime * 1000;
  }

  publishTransport(fromRemote) {
    if (fromRemote) return;
    let payload = {
      type: "transport",
      playing: !!this.playing,
      beatOriginMs: this.beatOriginMs,
      bpm: this.bpm,
      userID: this.userID,
      sessionID: this.sessionID,
    };
    if (this.rtcInstance) this.rtcInstance.sendMessage(payload);
    // ponytail: Firestore backup while PeerJS retries; no Cristian lock here.
    if (this.patchName) {
      putTransportInFireStore(this.patchName, {
        playing: !!this.playing,
        beatOriginMs: this.beatOriginMs,
        bpm: this.bpm,
        sessionID: this.sessionID,
        userID: this.userID,
      });
    }
  }

  startBeatPublishLoop() {
    if (!this.admin) return;
    if (this._beatPublishTimer) return;
    this._beatPublishTimer = setInterval(() => {
      if (!this.playing) return;
      this.beatOriginMs = this.computeBeatOriginMs();
      this.publishTransport(false);
    }, 5000);
  }

  stopBeatPublishLoop() {
    if (this._beatPublishTimer) {
      clearInterval(this._beatPublishTimer);
      this._beatPublishTimer = null;
    }
  }

  applyTransport(opts) {
    opts = opts || {};
    let playing = !!opts.playing;
    let fromRemote = !!opts.fromRemote;
    let prev = this.playing;
    this.playing = playing;
    if (opts.bpm != null && !isNaN(opts.bpm)) {
      this.bpm = opts.bpm;
      for (let c of this.components) {
        if (c.updateBPM) c.updateBPM();
      }
      this.putBPMInButton();
    }
    if (opts.beatOriginMs != null) this.beatOriginMs = opts.beatOriginMs;

    if (playing) {
      if (this.admin && !fromRemote && this.beatOriginMs == null) {
        this.beatOriginMs = this.computeBeatOriginMs();
      }
      let resumeResult = this.actx.resume();
      if (resumeResult && resumeResult.then) {
        resumeResult.catch(() => {
          this.showMessage("Click ▶ to unlock audio");
        });
      }
      if (this.playButton) this.playButton.innerHTML = " ■ ";
      if (this.admin && !fromRemote) this.startBeatPublishLoop();
    } else {
      this.actx.suspend();
      if (this.playButton) this.playButton.innerHTML = " ▶ ";
      if (this.admin) this.stopBeatPublishLoop();
    }

    this.refreshClockSkew();

    if (fromRemote && prev != playing) {
      this.showMessage(playing ? "Admin: play" : "Admin: pause");
    }
    if (this.admin && !fromRemote) this.publishTransport(false);
  }

  userIdForPeerId(peerId) {
    if (!peerId) return null;
    for (let u of this.connectedUsers || []) {
      if (u && u.peerId == peerId) return u.userID;
    }
    let cut = String(peerId).lastIndexOf("_");
    return cut > 0 ? peerId.slice(0, cut) : peerId;
  }

  sessionIdForPeerId(peerId) {
    if (!peerId) return null;
    for (let u of this.connectedUsers || []) {
      if (u && u.peerId == peerId) return u.sessionID;
    }
    let cut = String(peerId).lastIndexOf("_");
    return cut > 0 ? peerId.slice(cut + 1) : null;
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
    let { x, y } = this.clientToRackCoords(e.clientX, e.clientY);
    this._lastPointerX = x;
    this._lastPointerY = y;
    if (this.hasOpenRtc()) {
      let now = performance.now();
      if (now - this._lastCursorSentAt < 66) return;
      this._lastCursorSentAt = now;
      this.rtcInstance.sendMessage({
        type: "cursor",
        userID: this.userID,
        sessionID: this.sessionID,
        x,
        y,
      });
      return;
    }
    this.queueLivePresence({
      userID: this.userID,
      sessionID: this.sessionID,
      x,
      y,
    });
  }

  broadcastLocalDrag(componentId, x, y, isEnd) {
    if (this.syncingRemote) return;
    let msg = {
      type: isEnd ? "dragEnd" : "drag",
      userID: this.userID,
      sessionID: this.sessionID,
      componentId,
      x,
      y,
    };
    if (this.hasOpenRtc()) {
      if (!isEnd) {
        let now = performance.now();
        if (now - (this._lastDragSentAt || 0) < 50) {
          this._pendingDragMsg = msg;
          return;
        }
        this._lastDragSentAt = now;
        this._pendingDragMsg = null;
      } else if (this._pendingDragMsg) {
        this._pendingDragMsg = null;
      }
      this.rtcInstance.sendMessage(msg);
    } else if (!isEnd) {
      this.queueLivePresence({
        userID: this.userID,
        sessionID: this.sessionID,
        x: this._lastPointerX,
        y: this._lastPointerY,
        componentId,
        dragX: x,
        dragY: y,
        dragging: true,
      });
    }
    if (isEnd) this.clearLiveDrag(componentId, x, y);
  }

  queueLivePresence(fields) {
    if (!this.patchName) return;
    this._pendingLive = Object.assign(this._pendingLive || {}, fields);
    let now = performance.now();
    let wait = 250 - (now - (this._lastLiveSentAt || 0));
    if (wait > 0) {
      if (!this._liveFlushTimer) {
        this._liveFlushTimer = setTimeout(() => this.flushLivePresence(), wait);
      }
      return;
    }
    this.flushLivePresence();
  }

  flushLivePresence() {
    this._liveFlushTimer = null;
    if (!this._pendingLive || !this.patchName) return;
    this._lastLiveSentAt = performance.now();
    let data = this._pendingLive;
    this._pendingLive = null;
    writeLivePresence(this.patchName, this.sessionID, data);
  }

  clearLiveDrag(componentId, x, y) {
    if (!this.patchName) return;
    if (this._pendingLive) {
      this._pendingLive.dragging = false;
      this._pendingLive.componentId = componentId;
      this._pendingLive.dragX = x;
      this._pendingLive.dragY = y;
    }
    writeLivePresence(this.patchName, this.sessionID, {
      userID: this.userID,
      sessionID: this.sessionID,
      componentId,
      dragX: x,
      dragY: y,
      dragging: false,
    });
  }

  applyLivePresenceSnap(snap) {
    if (!snap) return;
    snap.docChanges().forEach((change) => {
      let sessionID = change.doc.id;
      if (sessionID == this.sessionID) return;
      if (change.type == "removed") {
        delete this._remoteDragging[sessionID];
        this.removeRemoteCursor(sessionID);
        return;
      }
      let data = change.doc.data() || {};
      data.sessionID = data.sessionID || sessionID;
      if (data.x != null && data.y != null) this.applyRemoteCursor(data);
      if (
        data.componentId == null ||
        data.dragX == null ||
        data.dragY == null
      ) {
        return;
      }
      let dragMsg = {
        userID: data.userID,
        sessionID: data.sessionID,
        componentId: data.componentId,
        x: data.dragX,
        y: data.dragY,
      };
      if (data.dragging) {
        this._remoteDragging[sessionID] = true;
        this.applyRemoteDrag(dragMsg, false);
      } else if (this._remoteDragging[sessionID]) {
        delete this._remoteDragging[sessionID];
        this.applyRemoteDrag(dragMsg, true);
      }
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

  setComponentGrabbed(comp, userID) {
    if (!comp || !comp.container) return;
    comp.container.classList.add("grabbed");
    comp.container.style.setProperty("--grab-hue", this.hueFromUserId(userID));
  }

  clearComponentGrabbed(comp) {
    if (!comp || !comp.container) return;
    if (comp._dragging) return;
    comp.container.classList.remove("grabbed");
    comp.container.style.removeProperty("--grab-hue");
  }

  clearRemoteDragForSession(sessionKey) {
    if (!sessionKey) return;
    for (let id of Object.keys(this._remoteDragAnim)) {
      let anim = this._remoteDragAnim[id];
      if (anim.sessionID != sessionKey && anim.userID != sessionKey) continue;
      this.clearComponentGrabbed(this.getComponentByID(id));
      delete this._remoteDragAnim[id];
    }
  }

  tickPresenceInterpolation(dt) {
    let t = 1 - Math.exp(-18 * dt);
    let epsilon = 0.5;

    for (let key of Object.keys(this.remoteCursors)) {
      let entry = this.remoteCursors[key];
      if (entry.targetX == null) continue;
      entry.x += (entry.targetX - entry.x) * t;
      entry.y += (entry.targetY - entry.y) * t;
      entry.el.style.left = entry.x + "px";
      entry.el.style.top = entry.y + "px";
    }

    for (let id of Object.keys(this._remoteDragAnim)) {
      let anim = this._remoteDragAnim[id];
      let compo = this.getComponentByID(id);
      if (!compo || !compo.container) {
        delete this._remoteDragAnim[id];
        continue;
      }
      let ox = anim.x;
      let oy = anim.y;
      anim.x += (anim.targetX - anim.x) * t;
      anim.y += (anim.targetY - anim.y) * t;
      if (Math.abs(anim.x - ox) > 0.01 || Math.abs(anim.y - oy) > 0.01) {
        this.markEndpointsDirty(id);
      }
      let x = anim.x + "px";
      let y = anim.y + "px";
      compo.container.style.left = x;
      compo.container.style.top = y;
      compo.container.style.setProperty("--posX", x);
      compo.container.style.setProperty("--posY", y);

      if (
        !anim.dragging &&
        Math.abs(anim.x - anim.targetX) < epsilon &&
        Math.abs(anim.y - anim.targetY) < epsilon
      ) {
        this.clearComponentGrabbed(compo);
        delete this._remoteDragAnim[id];
      }
    }
  }

  ensureRemoteCursor(userID, sessionID) {
    let key = sessionID || userID;
    if (!key) return null;
    if (sessionID && sessionID == this.sessionID) return null;
    if (!sessionID && userID == this.userID) return null;
    let entry = this.remoteCursors[key];
    if (entry) return entry;
    let el = document.createElement("div");
    el.className = "remote-cursor";
    el.style.setProperty("--cursor-hue", this.hueFromUserId(userID || key));
    let label = document.createElement("span");
    label.className = "remote-cursor-label";
    label.textContent = userID || key;
    el.appendChild(label);
    this.container.appendChild(el);
    entry = { el, lastSeen: performance.now(), userID };
    this.remoteCursors[key] = entry;
    return entry;
  }

  applyRemoteCursor(msg) {
    if (!msg || msg.x == null || msg.y == null) return;
    let entry = this.ensureRemoteCursor(msg.userID, msg.sessionID);
    if (!entry) return;
    entry.targetX = msg.x;
    entry.targetY = msg.y;
    if (entry.x == null) {
      entry.x = msg.x;
      entry.y = msg.y;
      entry.el.style.left = msg.x + "px";
      entry.el.style.top = msg.y + "px";
    }
    entry.lastSeen = performance.now();
  }

  applyRemoteDrag(msg, isEnd) {
    if (!msg || !msg.componentId || msg.x == null || msg.y == null) return;
    let compo = this.getComponentByID(msg.componentId);
    if (!compo || !compo.container) return;
    let x = typeof msg.x == "number" ? msg.x : parseFloat(msg.x);
    let y = typeof msg.y == "number" ? msg.y : parseFloat(msg.y);
    let anim = this._remoteDragAnim[msg.componentId];
    if (!anim) {
      anim = {
        componentId: msg.componentId,
        x: parseFloat(compo.container.style.left) || x,
        y: parseFloat(compo.container.style.top) || y,
        targetX: x,
        targetY: y,
        userID: msg.userID,
        sessionID: msg.sessionID,
        dragging: !isEnd,
      };
      this._remoteDragAnim[msg.componentId] = anim;
    } else {
      anim.targetX = x;
      anim.targetY = y;
      anim.userID = msg.userID;
      anim.sessionID = msg.sessionID;
      anim.dragging = !isEnd;
    }
    if (!isEnd) {
      this.setComponentGrabbed(compo, msg.userID);
    } else {
      this.clearComponentGrabbed(compo);
    }
    if (msg.userID || msg.sessionID) {
      let entry = this.ensureRemoteCursor(msg.userID, msg.sessionID);
      if (entry) entry.lastSeen = performance.now();
    }
  }

  removeRemoteCursor(userID) {
    let entry = this.remoteCursors[userID];
    if (entry) {
      if (entry.el && entry.el.parentNode)
        entry.el.parentNode.removeChild(entry.el);
      delete this.remoteCursors[userID];
    }
    this.clearRemoteDragForSession(userID);
  }

  broadcastLocalInput(device, payload) {
    if (!this.rtcInstance) return;
    if (!Array.isArray(this.connectedUsers) || this.connectedUsers.length < 2) {
      return;
    }
    let continuous =
      device == "mouse" || device == "gamepad" || device == "phone";
    if (continuous && !(device == "phone" && payload.shake)) {
      let now = performance.now();
      let last = this._lastInputSentAt[device] || 0;
      if (now - last < 66) return;
      this._lastInputSentAt[device] = now;
    }
    this.rtcInstance.sendMessage({
      type: "input",
      device,
      userID: this.userID,
      sessionID: this.sessionID,
      ...payload,
    });
  }

  onRemoteInput(msg) {
    if (!msg || !msg.userID || !msg.device) return;
    if (msg.userID == this.userID) return;
    let entry = this.remoteInputs[msg.userID];
    if (!entry) {
      entry = {};
      this.remoteInputs[msg.userID] = entry;
    }
    if (msg.device == "mouse") {
      entry.mouse = { x: msg.x, y: msg.y };
    } else if (msg.device == "keyboard") {
      entry.keyboard = { event: msg.event, which: msg.which };
    } else if (msg.device == "gamepad") {
      entry.gamepad = { axes: msg.axes, buttons: msg.buttons };
    } else if (msg.device == "phone") {
      entry.phone = {
        tiltX: msg.tiltX,
        tiltY: msg.tiltY,
        heading: msg.heading,
        accelX: msg.accelX,
        accelY: msg.accelY,
        accelZ: msg.accelZ,
        shake: msg.shake,
      };
    }
    for (let c of this.components || []) {
      if (c && c.onRemoteInput instanceof Function) c.onRemoteInput(msg);
    }
  }

  clearRemoteInputs(userID) {
    if (!userID) return;
    delete this.remoteInputs[userID];
  }

  refreshControllerSeatSelects() {
    for (let c of this.components || []) {
      if (c && c.refreshSeatSelect instanceof Function) c.refreshSeatSelect();
    }
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
    let onlinePeerIds = new Set();
    let onlineSessions = new Set();
    let onlineUserIDs = new Set();
    for (let u of users || []) {
      if (!u || u.sessionID == this.sessionID) continue;
      if (u.sessionID) onlineSessions.add(u.sessionID);
      if (u.userID) onlineUserIDs.add(u.userID);
      if (u.peerId) {
        onlinePeerIds.add(u.peerId);
        this.rtcInstance.connect(u.peerId);
      }
    }
    for (let peerId of this.rtcInstance.listPeerIds()) {
      if (!onlinePeerIds.has(peerId)) this.rtcInstance.disconnect(peerId);
    }
    for (let key of Object.keys(this.remoteCursors)) {
      let entry = this.remoteCursors[key];
      let keep =
        onlineSessions.has(key) ||
        onlinePeerIds.has(key) ||
        (entry && entry.userID && onlineUserIDs.has(entry.userID));
      if (!keep) this.removeRemoteCursor(key);
    }
    for (let userID of Object.keys(this.remoteInputs)) {
      if (!onlineUserIDs.has(userID)) this.clearRemoteInputs(userID);
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
      localStorage["user_id"] = "user_" + makeid(8);
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
      if (loaded.playing != null || loaded.beatOriginMs != null) {
        this.applyTransport({
          playing: !!loaded.playing,
          beatOriginMs: loaded.beatOriginMs,
          bpm: loaded.bpm,
          fromRemote: true,
        });
      }
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

    listenToLivePresence(this.patchName, (snap) => {
      this.applyLivePresenceSnap(snap);
    });
  }
  handleChangesInUsers(users) {
    let now = Date.now();
    let live = [];
    for (let u of users || []) {
      if (!u) continue;
      if (u.sessionID != this.sessionID && isPatchUserStale(u, now)) {
        removeMeAsUserInThisPatchInFirebase(
          this.patchName,
          u._id || u.sessionID,
        );
        continue;
      }
      live.push(u);
    }
    this.connectedUsers = live;
    this.listOfConnectedUsersElement.innerHTML =
      live.length +
      (live.length > 1 ? " users online" : " user online") +
      (this.admin ? " (you're the admin)" : "");

    this.syncRtcMesh(live);

    let nextSessions = new Set();
    let nextLabels = {};
    for (let u of live) {
      if (!u || !u.sessionID) continue;
      nextSessions.add(u.sessionID);
      nextLabels[u.sessionID] = u.userID || u.sessionID;
    }
    if (this._prevSessions) {
      for (let s of nextSessions) {
        if (s == this.sessionID) continue;
        if (!this._prevSessions.has(s)) {
          this.showMessage((nextLabels[s] || s) + " joined");
        }
      }
      for (let s of this._prevSessions) {
        if (s == this.sessionID) continue;
        if (!nextSessions.has(s)) {
          this.showMessage((this._prevSessionLabels[s] || s) + " left");
        }
      }
    }
    this._prevSessions = nextSessions;
    this._prevSessionLabels = nextLabels;

    let userKey = live
      .map((u) => u.userID || "")
      .sort()
      .join(",");
    if (userKey != this._lastUserKey) {
      this._lastUserKey = userKey;
      this.refreshControllerSeatSelects();
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
    if (this.bulkLoading || this.restoringHistory) return;
    if (e.sessionID && e.sessionID == this.sessionID) {
      return;
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

    if (e.playing != null || e.beatOriginMs != null) {
      this.applyTransport({
        playing: e.playing != null ? e.playing : this.playing,
        beatOriginMs:
          e.beatOriginMs != null ? e.beatOriginMs : this.beatOriginMs,
        bpm: e.bpm,
        fromRemote: true,
      });
    }

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
      this.updateCarpetParallax(left, top);
      this.updateCarpetScale();
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
      "BPM (" + this.bpm + ")";
  }
  createCanvasOnTop() {
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("linesCanvas");
    this.appEl.appendChild(this.canvas);
    this._cableWorker = null;
    this._workerCableIds = new Set();
    this._cableCanvasW = 0;
    this._cableCanvasH = 0;
    try {
      if (
        typeof Worker === "undefined" ||
        !this.canvas.transferControlToOffscreen
      ) {
        throw new Error("OffscreenCanvas unavailable");
      }
      let offscreen = this.canvas.transferControlToOffscreen();
      this._cableWorker = new Worker("js/cableWorker.js");
      let w = this.appEl.clientWidth || 1;
      let h = this.appEl.clientHeight || 1;
      this._cableCanvasW = w;
      this._cableCanvasH = h;
      this._cableWorker.postMessage(
        {
          type: "init",
          canvas: offscreen,
          width: w,
          height: h,
          params: Object.assign({}, this.cables),
        },
        [offscreen],
      );
      this.ctx = null;
      this.cableWorld = null;
    } catch (err) {
      console.warn("Cable worker fallback:", err);
      this._cableWorker = null;
      this.ctx = this.canvas.getContext("2d");
      this.sizeCableCanvas();
    }
    window.addEventListener("resize", () => {
      this.sizeCableCanvas();
      this.markCablesDirty();
    });
  }
  initCableWorld() {
    if (!this._cableWorker) {
      this.cableWorld = new CableWorld();
      this.cableWorld.setParams(this.cables);
    }
    this._cableLastTs = 0;
    window.addEventListener("pointermove", (e) => {
      this._cableMouseClient.x = e.clientX;
      this._cableMouseClient.y = e.clientY;
    });
    this.startCableLoop();
    this.updateSysStatus();
    this.updateCarpetScale();
  }
  postCableWorker(msg, transfer) {
    if (!this._cableWorker) return;
    if (transfer) this._cableWorker.postMessage(msg, transfer);
    else this._cableWorker.postMessage(msg);
  }
  wakeCables() {
    if (this._cableWorker) this.postCableWorker({ type: "wake" });
    else if (this.cableWorld) this.cableWorld.wake();
  }
  setCableParams(params) {
    if (this._cableWorker) {
      this.postCableWorker({
        type: "params",
        params: Object.assign({}, params),
      });
    } else if (this.cableWorld) {
      this.cableWorld.setParams(params);
    }
  }
  startCableLoop() {
    let tick = (ts) => {
      this._cableRaf = requestAnimationFrame(tick);
      let dt = this._cableLastTs ? (ts - this._cableLastTs) / 1000 : 0.016;
      this._cableLastTs = ts;
      let t0 = performance.now();
      this.runCableFrame(dt);
      let frameMs = performance.now() - t0;
      let fpsInst = dt > 0 ? 1 / dt : 60;
      this._sysFrameMs += (frameMs - this._sysFrameMs) * 0.15;
      this._sysFps += (fpsInst - this._sysFps) * 0.15;
      if (ts - this._sysHudAt > 250) {
        this._sysHudAt = ts;
        this.updateSysStatus();
      }
    };
    this._cableRaf = requestAnimationFrame(tick);
  }
  updateSysStatus() {
    if (!this.sysStatusEl) return;
    let state = (this.actx && this.actx.state) || "closed";
    let fps = Math.round(this._sysFps || 0);
    let load = Math.min(
      100,
      Math.round(((this._sysFrameMs || 0) / 16.67) * 100),
    );
    let n = (this.components && this.components.length) || 0;
    this.sysStatusEl.textContent =
      "audio " + state + " · " + fps + " fps · " + load + "% · " + n + "n";
    this.sysStatusEl.classList.toggle("warn", load >= 80 || fps < 30);
    this.sysStatusEl.classList.toggle("dim", state !== "running");
  }
  sizeCableCanvas() {
    let w = this.appEl.clientWidth || 1;
    let h = this.appEl.clientHeight || 1;
    if (this._cableWorker) {
      if (w === this._cableCanvasW && h === this._cableCanvasH) return;
      this._cableCanvasW = w;
      this._cableCanvasH = h;
      this.postCableWorker({ type: "resize", width: w, height: h });
      return;
    }
    if (!this.canvas || !this.ctx) return;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = 3;
  }
  cacheRackRect() {
    this._rackRect = this.container.getBoundingClientRect();
    this._rackScale = this.scale || 1;
  }
  jackCenterWorld(el) {
    if (!el) return null;
    let rack = this._rackRect || this.container.getBoundingClientRect();
    let s = this._rackScale != null ? this._rackScale : this.scale || 1;
    let box = el.getBoundingClientRect();
    let cx = box.left + box.width / 2;
    let cy = box.top + box.height / 2;
    return {
      x: (cx - rack.left) / s,
      y: (cy - rack.top) / s,
    };
  }
  clientToWorld(clientX, clientY) {
    let rack = this._rackRect || this.container.getBoundingClientRect();
    let s = this._rackScale != null ? this._rackScale : this.scale || 1;
    return {
      x: (clientX - rack.left) / s,
      y: (clientY - rack.top) / s,
    };
  }
  markCablesDirty() {
    this._cablesDirty = true;
    this.wakeCables();
  }
  markEndpointsDirty(componentId) {
    if (componentId == null) return;
    if (!this._endpointDirtyIds) this._endpointDirtyIds = new Set();
    this._endpointDirtyIds.add(componentId);
    this.wakeCables();
  }
  connectionCableColor(conn) {
    let key =
      conn.from.type + conn.to.type + conn.audioParam + conn.numberOfOutput;
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return App.CABLE_COLORS[h % App.CABLE_COLORS.length];
  }
  connectionJackEls(conn) {
    let fromEl = conn.from.outputs.querySelector(
      '.outputButton[numberOfOutput="' + conn.numberOfOutput + '"]',
    );
    let toEl = (conn.to.inputElements[conn.audioParam] || {}).button;
    return { fromEl, toEl };
  }
  measureConnectionEndpoints(conn) {
    let { fromEl, toEl } = this.connectionJackEls(conn);
    if (!fromEl || !toEl) return null;
    let a = this.jackCenterWorld(fromEl);
    let b = this.jackCenterWorld(toEl);
    if (!a || !b) return null;
    return {
      id: conn.id,
      x0: a.x,
      y0: a.y,
      x1: b.x,
      y1: b.y,
      color: this.connectionCableColor(conn),
      fromEl,
      toEl,
    };
  }
  syncOneConnectionEndpoints(conn) {
    if (!conn) return;
    let m = this.measureConnectionEndpoints(conn);
    if (!m) return;
    if (this._cableWorker) return m;
    if (!this.cableWorld) return;
    let slot = this.cableWorld.byConnectionId.get(conn.id);
    if (slot == null) {
      this.cableWorld.createCable({
        x0: m.x0,
        y0: m.y0,
        x1: m.x1,
        y1: m.y1,
        fromEl: m.fromEl,
        toEl: m.toEl,
        connectionId: conn.id,
        color: m.color,
      });
      return;
    }
    let cab = this.cableWorld.cables[slot];
    if (cab) {
      cab.fromEl = m.fromEl;
      cab.toEl = m.toEl;
      cab.color = m.color;
    }
    this.cableWorld.setEndpoints(slot, m.x0, m.y0, m.x1, m.y1, true);
  }
  syncEndpointsForComponents(componentIds) {
    if (!componentIds || !componentIds.size) return;
    if (this._cableWorker) {
      let cables = [];
      for (let conn of this.getAllConnections()) {
        if (!componentIds.has(conn.from.id) && !componentIds.has(conn.to.id)) {
          continue;
        }
        let m = this.measureConnectionEndpoints(conn);
        if (m) {
          cables.push({
            id: m.id,
            x0: m.x0,
            y0: m.y0,
            x1: m.x1,
            y1: m.y1,
            color: m.color,
          });
          this._workerCableIds.add(m.id);
        }
      }
      if (cables.length) {
        this.postCableWorker({ type: "sync", cables, wake: true });
      }
      return;
    }
    if (!this.cableWorld) return;
    for (let conn of this.getAllConnections()) {
      if (!componentIds.has(conn.from.id) && !componentIds.has(conn.to.id)) {
        continue;
      }
      this.syncOneConnectionEndpoints(conn);
    }
  }
  collectMovingComponentIds() {
    let ids = this._endpointDirtyIds;
    if (!ids) ids = new Set();
    for (let c of this.components) {
      if (c._dragging) ids.add(c.id);
    }
    for (let id of Object.keys(this._remoteDragAnim || {})) {
      ids.add(id);
    }
    return ids;
  }
  syncPhysicsCables() {
    if (this._cableWorker) {
      this.syncPhysicsCablesWorker();
      return;
    }
    if (!this.cableWorld) return;
    if (this._cablesDirty) {
      let conns = this.getAllConnections();
      let live = new Set();
      for (let conn of conns) {
        live.add(conn.id);
        this.syncOneConnectionEndpoints(conn);
      }
      for (let [connId] of [...this.cableWorld.byConnectionId.entries()]) {
        if (!live.has(connId)) this.cableWorld.freeByConnectionId(connId);
      }
      this._cablesDirty = false;
      this._endpointDirtyIds = new Set();
      return;
    }
    let ids = this.collectMovingComponentIds();
    if (!ids.size) return;
    this.syncEndpointsForComponents(ids);
    this._endpointDirtyIds = new Set();
  }
  syncPhysicsCablesWorker() {
    if (this._cablesDirty) {
      let cables = [];
      let live = new Set();
      for (let conn of this.getAllConnections()) {
        let m = this.measureConnectionEndpoints(conn);
        if (!m) continue;
        live.add(conn.id);
        cables.push({
          id: m.id,
          x0: m.x0,
          y0: m.y0,
          x1: m.x1,
          y1: m.y1,
          color: m.color,
        });
      }
      let removeIds = [];
      for (let id of this._workerCableIds) {
        if (!live.has(id)) removeIds.push(id);
      }
      this._workerCableIds = live;
      this.postCableWorker({
        type: "sync",
        full: true,
        cables,
        removeIds,
        wake: true,
      });
      this._cablesDirty = false;
      this._endpointDirtyIds = new Set();
      return;
    }
    let ids = this.collectMovingComponentIds();
    if (!ids.size) return;
    this.syncEndpointsForComponents(ids);
    this._endpointDirtyIds = new Set();
  }
  syncCableGhost() {
    if (this._cableWorker) {
      if (!this.lastOutputClicked || !this.lastOutputClicked.output) {
        this.postCableWorker({ type: "sync", ghost: null });
        return;
      }
      let fromEl = this.lastOutputClicked.output;
      let a = this.jackCenterWorld(fromEl);
      let m = this.clientToWorld(
        this._cableMouseClient.x,
        this._cableMouseClient.y,
      );
      if (!a) return;
      this.postCableWorker({
        type: "sync",
        ghost: { x0: a.x, y0: a.y, x1: m.x, y1: m.y },
        wake: true,
      });
      return;
    }
    if (!this.cableWorld) return;
    if (!this.lastOutputClicked || !this.lastOutputClicked.output) {
      this.cableWorld.clearGhost();
      return;
    }
    this.cableWorld.wake();
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
    if (this._cableWorker) this.postCableWorker({ type: "sync", ghost: null });
    else if (this.cableWorld) this.cableWorld.clearGhost();
  }
  cableViewPayload(dt) {
    let rack = this._rackRect || this.container.getBoundingClientRect();
    let canvasBox = this._canvasRect || this.canvas.getBoundingClientRect();
    let s = this._rackScale || this.scale || 1;
    let ox = rack.left - canvasBox.left;
    let oy = rack.top - canvasBox.top;
    let cw = this._cableWorker ? this._cableCanvasW : this.canvas.width;
    let ch = this._cableWorker ? this._cableCanvasH : this.canvas.height;
    return {
      type: "view",
      dt: dt || 0.016,
      ox,
      oy,
      scale: s,
      worldL: (0 - ox) / s,
      worldT: (0 - oy) / s,
      worldR: (cw - ox) / s,
      worldB: (ch - oy) / s,
    };
  }
  runCableFrame(dt) {
    if (!this._cableWorker && (!this.cableWorld || !this.ctx)) return;
    if (
      this._pendingDragMsg &&
      this.hasOpenRtc() &&
      performance.now() - (this._lastDragSentAt || 0) >= 50
    ) {
      this._lastDragSentAt = performance.now();
      this.rtcInstance.sendMessage(this._pendingDragMsg);
      this._pendingDragMsg = null;
    }
    this.tickPresenceInterpolation(dt);

    if (this._panning) {
      this.updateCarpetParallax(this._panCurLeft, this._panCurTop);
      return;
    }

    this.sizeCableCanvas();
    this.cacheRackRect();
    this.flushPendingComponentDrag();
    this.syncPhysicsCables();
    this.syncCableGhost();

    if (this._cableWorker) {
      this.postCableWorker(this.cableViewPayload(dt));
      return;
    }

    let view = this.cableViewPayload(dt);
    this.cableWorld.updateCullFlags(
      view.worldL,
      view.worldT,
      view.worldR,
      view.worldB,
    );
    this.cableWorld.step(dt);
    this.paintCablesLocal(view);
  }
  paintCablesLocal(view) {
    let ctx = this.ctx;
    let s = view.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, view.ox, view.oy);
    this.cableWorld.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  flushPendingComponentDrag() {
    let comp = this._pendingDragComp;
    if (!comp || !comp._dragging) {
      this._pendingDragComp = null;
      return;
    }
    this._pendingDragComp = null;
    let rack = this._rackRect || this.container.getBoundingClientRect();
    let s = this._rackScale != null ? this._rackScale : this.scale || 1;
    let x = (comp._dragClientX - rack.left) / s - comp._grabX;
    let y = (comp._dragClientY - rack.top) / s - comp._grabY;
    comp.container.style.left = x + "px";
    comp.container.style.top = y + "px";
    comp.container.style.setProperty("--posX", comp.container.style.left);
    comp.container.style.setProperty("--posY", comp.container.style.top);
    this.markEndpointsDirty(comp.id);
    if (!this.syncingRemote) {
      this.broadcastLocalDrag(comp.id, x, y, false);
    }
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
    let barSec = (60 / bpm) * 4;
    if (this.beatOriginMs != null && this.playing) {
      let transportSec = (this.adminNowMs() - this.beatOriginMs) / 1000;
      let phase = ((transportSec % barSec) + barSec) % barSec;
      return barSec - phase;
    }
    return barSec - (this.actx.currentTime % barSec);
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
      this._panLeft = parseFloat(this.container.style.left);
      this._panTop = parseFloat(this.container.style.top);
      if (isNaN(this._panLeft) || isNaN(this._panTop)) {
        let cs = getComputedStyle(this.container);
        if (isNaN(this._panLeft)) this._panLeft = parseFloat(cs.left) || 0;
        if (isNaN(this._panTop)) this._panTop = parseFloat(cs.top) || 0;
      }
      this._panCurLeft = this._panLeft;
      this._panCurTop = this._panTop;
      this._canvasRect = this.canvas.getBoundingClientRect();
      this.postCableWorker({ type: "pause" });
      elem.setPointerCapture(e.pointerId);
    });

    elem.addEventListener("pointermove", (e) => {
      if (!this._panning) return;
      let dx = e.clientX - this._panStartX;
      let dy = e.clientY - this._panStartY;
      this._panCurLeft = this._panLeft + dx;
      this._panCurTop = this._panTop + dy;
      let s = this.scale || 1;
      let tx = "translate(" + dx + "px," + dy + "px)";
      this.container.style.transform = tx + " scale(" + s + ")";
      this.canvas.style.transform = tx;
    });

    elem.addEventListener("pointerup", (e) => this.endPan(e));
    elem.addEventListener("pointercancel", (e) => this.endPan(e));

    let box = this.container.getBoundingClientRect();
    this.updateCarpetParallax(box.x, box.y);
    this.updateCarpetScale();
  }
  endPan() {
    if (!this._panning) return;
    this._panning = false;
    let s = this.scale || 1;
    this.container.style.left = this._panCurLeft + "px";
    this.container.style.top = this._panCurTop + "px";
    this.container.style.transform = "scale(" + s + ")";
    this.canvas.style.transform = "";
    this._canvasRect = null;
    this.updateCarpetParallax(this._panCurLeft, this._panCurTop);
    this.postCableWorker({ type: "resume" });
    this.markCablesDirty();
  }
  updateCarpetParallax(x, y) {
    if (!this.appEl) return;
    this.appEl.style.backgroundPosition =
      0.25 * (x + 500) + "px " + 0.25 * (y + 500) + "px";
  }
  updateCarpetScale() {
    if (!this.appEl) return;
    let s = this.scale || 1;
    this.appEl.style.backgroundSize = 95 + 5 * s + "% auto";
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
  addDemultiplexor() {
    this.components.push(new Demultiplexor(this));
  }
  addSequentialSwitch() {
    this.components.push(new SequentialSwitch(this));
  }
  addSequentialDemux() {
    this.components.push(new SequentialDemux(this));
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

  // addAiComponent2() {
  //   this.components.push(new AiComponent2(this));
  // }

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
  addPolyphonicKeyboard() {
    this.components.push(new PolyphonicKeyboard(this));
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
  addMulberry32() {
    this.components.push(new Mulberry32(this));
  }
  addMouse() {
    this.components.push(new Mouse(this));
  }

  addImageMaker() {
    this.components.push(new ImageMaker(this));
  }
  addCanvasPlotter() {
    this.components.push(new CanvasPlotter(this));
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
  addPolySequencer() {
    this.components.push(new PolySequencer(this));
  }
  addPhoneSensors() {
    this.components.push(new PhoneSensors(this));
  }
  addSampleHold() {
    this.components.push(new SampleHold(this));
  }
  addScanline() {
    this.components.push(new ScanlineSynth(this));
  }
  addKick808() {
    this.components.push(new Kick808(this));
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
      if (path.startsWith("local:")) {
        let name = path.slice(6);
        let raw = localStorage[this.SAVE_PREFIX + name];
        if (!raw) {
          console.warn("could not load saved patch", name);
        } else {
          this.loadFromFile(JSON.parse(raw));
        }
      } else {
        let res = await fetch(path);
        this.loadFromFile(await res.json());
      }
    } catch (e) {
      console.warn("could not load sample patch", path, e);
    }
    let sel = document.getElementById("samplePatchSelect");
    if (sel) sel.value = "";
  }

  populateSavedPatches() {
    let prefix = this.SAVE_PREFIX;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix))
        this.addSavedPatchOption(key.slice(prefix.length));
    });
  }

  addSavedPatchOption(name) {
    let sel = document.getElementById("samplePatchSelect");
    if (!sel) return;
    let value = "local:" + name;
    for (let opt of sel.options) {
      if (opt.value === value) return;
    }
    let opt = document.createElement("option");
    opt.value = value;
    opt.textContent = name;
    sel.appendChild(opt);
  }

  saveLocalPatch() {
    let name = prompt("name of this patch");
    if (!name) return;
    localStorage[this.SAVE_PREFIX + name] = JSON.stringify(this.serialize());
    this.addSavedPatchOption(name);
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
      this.components.filter((c) => c.id != "output").map((c) => c.quickSave()),
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
    let remoteAdmin = (this.connectedUsers || []).some(
      (u) => u && u.admin && u.sessionID != this.sessionID,
    );
    let canConduct = this.admin || !this.patchName || !remoteAdmin;
    if (canConduct) {
      let next = !this.playing;
      if (next) this.beatOriginMs = this.computeBeatOriginMs();
      this.applyTransport({ playing: next, fromRemote: false });
      return;
    }
    // Guest under admin: click is autoplay gesture only.
    if (this.playing) {
      let resumeResult = this.actx.resume();
      if (resumeResult && resumeResult.then) {
        resumeResult.catch(() => {
          this.showMessage("Click ▶ to unlock audio");
        });
      }
      if (this.playButton) this.playButton.innerHTML = " ■ ";
      this.refreshClockSkew();
    } else {
      this.showMessage("Waiting for admin play");
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
      cableAlpha: num(src.cableAlpha, d.cableAlpha),
    };
    this.setCableParams(this.cables);
    this.syncCableSliders();
    this.updateAllLines();
  }

  applyCableParamsFromPeer(cables) {
    this.applyCableParams(cables);
  }

  broadcastCableParams() {
    if (!this.rtcInstance) return;
    this.rtcInstance.sendMessage({
      type: "cableParams",
      userID: this.userID,
      sessionID: this.sessionID,
      cables: Object.assign({}, this.cables),
    });
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
      this.setCableParams(this.cables);
      this.broadcastCableParams();
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
    let Ctor =
      (comp && App.COMPONENT_CLASSES[comp.constructor]) ||
      (comp && App.COMPONENT_CLASSES[comp.type]);
    if (Ctor) return Ctor.name;
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
  Mulberry32,
  CustomProcessorComponent,
  Mixer,
  Sequencer,
  PolySequencer,
  PhoneSensors,
  SampleHold,
  ScanlineSynth,
  Kick808,
  EnvelopeGenerator,
  ConstantValueNode,
  Mouse,
  KeyboardComponent,
  PolyphonicKeyboard,
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
  Demultiplexor,
  SequentialSwitch,
  SequentialDemux,
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
  CanvasPlotter,
  Shader,
  WebRTCSender,
  WebRTCReceiver,
  Output,
};

for (let key of Object.keys(App.COMPONENT_CLASSES)) {
  if (key == "Gain") continue;
  App.COMPONENT_CLASSES[key].classKey = key;
}
if (LerpComponent.name != "lerp" || LerpComponent.classKey != "LerpComponent") {
  console.error("component title/classKey mismatch");
}
