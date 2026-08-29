class PhoneSensors extends Component {
  static name = "Phone";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Phone / tablet motion as CV. Enable sensors (iOS asks permission). Outputs: tiltX (left-right), tiltY (front-back), heading, accel XYZ, shake pulse. Shake a snare, tilt a filter. Seat select picks whose phone drives the module.";
    this.outputLabels = [
      "tiltX",
      "tiltY",
      "heading",
      "accelX",
      "accelY",
      "accelZ",
      "shake",
    ];
    this.valuesToSave = ["sourceUserID"];
    this.tiltX = 0;
    this.tiltY = 0;
    this.heading = 0;
    this.accelX = 0;
    this.accelY = 0;
    this.accelZ = 0;
    this.shake = 0;
    this._lastShakeAt = 0;
    this._listening = false;
    this.bindedOrient = this.onOrientation.bind(this);
    this.bindedMotion = this.onMotion.bind(this);
    this.createSeatSelect();
    this.createDisplay();
    this.createEnableButton();
    this.createNode();
  }

  createEnableButton() {
    this.enableButton = document.createElement("button");
    this.enableButton.classList.add("triggerInputFile");
    this.enableButton.innerHTML = "Enable sensors";
    this.enableButton.onclick = (e) => {
      e.stopPropagation();
      this.enableSensors();
    };
    (this.main || this.container).appendChild(this.enableButton);
  }

  async enableSensors() {
    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        await DeviceOrientationEvent.requestPermission();
      }
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
      ) {
        await DeviceMotionEvent.requestPermission();
      }
    } catch (err) {
      console.warn(err);
    }
    this.startListening();
    if (this.enableButton) this.enableButton.innerHTML = "Enabled";
  }

  startListening() {
    if (this._listening) return;
    this._listening = true;
    window.addEventListener("deviceorientation", this.bindedOrient);
    window.addEventListener("devicemotion", this.bindedMotion);
  }

  clamp90(v) {
    if (v == null || isNaN(v)) return 0;
    if (v > 90) v = 90;
    if (v < -90) v = -90;
    return v / 90;
  }

  onOrientation(e) {
    this.tiltX = this.clamp90(e.gamma);
    this.tiltY = this.clamp90(e.beta);
    let a = e.alpha;
    this.heading = a == null || isNaN(a) ? 0 : ((a % 360) + 360) % 360 / 360;
    this.pushState();
  }

  onMotion(e) {
    let acc = e.acceleration;
    if (!acc || acc.x == null) acc = e.accelerationIncludingGravity;
    let x = (acc && acc.x) || 0;
    let y = (acc && acc.y) || 0;
    let z = (acc && acc.z) || 0;
    this.accelX = x / 20;
    this.accelY = y / 20;
    this.accelZ = z / 20;
    let mag = Math.hypot(x, y, z);
    let now = performance.now();
    if (mag > 18 && now - this._lastShakeAt > 200) {
      this._lastShakeAt = now;
      this.shake = 1;
    } else if (now - this._lastShakeAt > 80) {
      this.shake = 0;
    }
    this.pushState();
  }

  pushState() {
    let payload = {
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      heading: this.heading,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      shake: this.shake,
    };
    this.app.broadcastLocalInput("phone", payload);
    if (!this.isLocalSeat()) return;
    this.applyState(payload);
  }

  applyState(p) {
    if (!p) return;
    this.tiltX = p.tiltX || 0;
    this.tiltY = p.tiltY || 0;
    this.heading = p.heading || 0;
    this.accelX = p.accelX || 0;
    this.accelY = p.accelY || 0;
    this.accelZ = p.accelZ || 0;
    this.shake = p.shake || 0;
    this.sendToWorklet();
    this.updateDisplay();
    if (this.shake) this.flashOutput(6);
  }

  sendToWorklet() {
    if (!this.sabBlock) return;
    let sab = this.sabBlock;
    sab.setSlot(0, this.tiltX);
    sab.setSlot(1, this.tiltY);
    sab.setSlot(2, this.heading);
    sab.setSlot(3, this.accelX);
    sab.setSlot(4, this.accelY);
    sab.setSlot(5, this.accelZ);
    sab.setSlot(6, this.shake);
    sab.publish();
  }

  updateDisplay() {
    if (!this.display) return;
    this.display.innerText =
      this.tiltX.toFixed(2) +
      " " +
      this.tiltY.toFixed(2) +
      " " +
      (this.shake ? "SHAKE" : "");
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/phoneSensorsWorklet.js").then(() => {
      this.node = this.makeWorklet("phone-sensors-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 7,
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.applyCachedRemoteIfNeeded();
      this.sendToWorklet();
    });
  }

  onRemoteInput(msg) {
    if (!msg || msg.device != "phone") return;
    if (msg.userID != this.sourceUserID) return;
    if (this.isLocalSeat()) return;
    this.applyState(msg);
  }

  applyCachedRemoteIfNeeded() {
    if (this.isLocalSeat()) return;
    let entry = (this.app.remoteInputs || {})[this.sourceUserID];
    if (!entry || !entry.phone) return;
    this.applyState(entry.phone);
  }

  onSeatChanged() {
    this.applyCachedRemoteIfNeeded();
  }

  updateUI() {
    this.refreshSeatSelect();
    this.applyCachedRemoteIfNeeded();
  }

  remove() {
    window.removeEventListener("deviceorientation", this.bindedOrient);
    window.removeEventListener("devicemotion", this.bindedMotion);
    this._listening = false;
    super.remove();
  }
}
