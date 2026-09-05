class Component {
  constructor(app, serializedData) {
    this.app = app;
    // classKey survives static name (Function.name is the title)
    this.type = this.constructor.classKey || this.constructor.name;
    this.serializedData = serializedData;
    this.createdBy = (this.serializedData || {}).createdBy
      ? (this.serializedData || {}).createdBy
      : this.app.userID;
    this.audioParams = [];
    this.retryCounter = 0;
    this.connections = [];
    this.running = false;
    this.audioProfileKeys = [];
    this.id = serializedData?.id
      ? serializedData.id
      : this.type.toLowerCase().substring(0, 7) + "_" + makeid(8);
    if (this.type.toLowerCase() == "output") this.id = "output";

    this.createContainer();
    this.createIcon();
    this.createDeleteButton();
    this.createView();
    this.inputElements = {};
    // this.outputElements = {};
    // this.app.actx.resume();
    this.active = false;
  }
  makeWorklet(name, opts) {
    return this.app.makeWorklet(name, opts, this);
  }
  createDeleteButton() {
    if (!this.isThisComponentMine()) return;
    this.deleteButton = document.createElement("button");
    this.deleteButton.classList.add("deleteButton");
    this.deleteButton.innerHTML = "🗑️";
    this.deleteButton.title = "Delete Component";
    if (this.headerRight) {
      this.headerRight.appendChild(this.deleteButton);
    } else {
      this.container.appendChild(this.deleteButton);
    }
    this.deleteButton.onclick = () => {
      this.remove();
    };
  }

  async quickSave(alsoSaveTheUpdatedListOfComponents) {
    if (!this.app) return;
    setTimeout(() => {
      if (this.app) this.app.afterEdit();
    }, 0);
    if (!this.app.patchName) return;
    if (this.id == "output") return;
    this.app.updateAllLines();
    // this.stopListeningToChanges();
    let serializedMe = this.serialize();
    serializedMe.sessionID = this.app.sessionID;
    serializedMe.userID = this.app.userID;

    // console.log("saving ", this.type, this.id, serializedMe);

    await createInstanceOfComponentInFirestore(
      this.app.patchName,
      serializedMe,
    );
    if (alsoSaveTheUpdatedListOfComponents) {
      setTimeout(() => {
        try {
          this.app.saveListOfComponentsInFirestore();
        } catch (e) {
          console.warn(e);
        }
      }, 100);
    }
    // this.startListeningToChangesInThiscomponent();
  }
  loadFromSerializedData(cb) {
    if (!this.serializedData || !this.container) return;

    if (this.node && this.serializedData.audioParams) {
      let keys = Object.keys(this.serializedData.audioParams);
      for (let key of keys) {
        if (key.startsWith("in")) continue;
        if (this.isTrigOrGateJack(key)) continue;
        let val = this.serializedData.audioParams[key];
        let param = this.node[key];
        if (!(param instanceof AudioParam) && this.node.parameters) {
          param = this.node.parameters.get(key);
        }
        if (param instanceof AudioParam) {
          param.value = val;
        }
        let inputEl = this.inputElements[key];
        if (inputEl && inputEl.knob) {
          inputEl.knob.setValue(val);
        } else if (inputEl && inputEl.textInput) {
          inputEl.textInput.value = val;
        }
      }

      if (this.serializedData.node?.type) {
        this.node.type = this.serializedData.node.type;
      }
    }
    if (this.serializedData.valuesToSave) {
      for (let key of this.serializedData.valuesToSave) {
        this[key] = this.serializedData[key];
      }
    }

    let doWeHaveToUpdateLines = false;
    if (
      this.container.style.left != this.serializedData.x ||
      this.container.style.top != this.serializedData.y
    ) {
      doWeHaveToUpdateLines = true;
    }
    this.container.style.left = this.serializedData.x;
    this.container.style.top = this.serializedData.y;

    if (!this.app.bulkLoading) {
      this.app.waitUntilAllComopnentsAreReady(() => {
        this.updateConnectionsFromSerializedData(
          (this.serializedData || {}).connections || [],
          doWeHaveToUpdateLines,
        );
        if (cb instanceof Function) cb();
      });
    } else if (cb instanceof Function) {
      cb();
    }

    if (this.updateUI instanceof Function) this.updateUI();
  }

  updateConnectionsFromSerializedData(connections, forceUpdateLines) {
    // console.log(
    //   "#update connections from serialized data",
    //   this.type,
    //   this.id,
    //   this.connections,
    //   connections
    // );
    let doWeHaveToUpdateLines = false;

    //CHECK IF WE GOTTA ADD NEW CONNECTIONS
    if (Array.isArray(connections)) {
      for (let incomingConn of connections) {
        let found = false;
        for (let currentConn of this.connections) {
          if (Connection.compareTwoConnections(incomingConn, currentConn)) {
            found = true;
            break;
          }
        }
        if (!found) {
          this.app.addSerializedConnection(incomingConn);
          doWeHaveToUpdateLines = true;
        }
      }
    }

    //CHECK IF WE GOTTA REMOVE SOME

    for (let currentConn of this.connections || []) {
      let found = false;
      for (let incomingConn of connections) {
        if (Connection.compareTwoConnections(incomingConn, currentConn)) {
          found = true;
          break;
        }
      }
      if (!found) {
        //THE CONNECTIONS DOES NOT EXIST IN FIRESTORE, SO DELETE IT

        currentConn.remove();
        doWeHaveToUpdateLines = true;
      }
    }
    if (doWeHaveToUpdateLines || forceUpdateLines) this.app.updateAllLines();
  }
  putLabels() {
    if (!(this.outputLabels || []).length) return;
    let rows = Array.from(this.container.querySelectorAll(".outputJackRow"));
    let buttons = Array.from(this.container.querySelectorAll(".outputButton"));
    for (let i = 0; i < this.outputLabels.length; i++) {
      let text = this.outputLabels[i];
      let lab = rows[i] && rows[i].querySelector(".jack-label");
      if (lab) lab.textContent = text;
      let elem = buttons[i];
      if (elem) {
        elem.title = text;
        elem.style.setProperty("--label", "'" + text + "'");
      }
    }
  }
  getOutputElements() {
    if (
      !Array.isArray(this.outputElements) ||
      this.outputElements.length == 0 ||
      !(this.outputElements[0] instanceof HTMLElement)
    ) {
      this.outputElements = Array.from(
        this.container.querySelectorAll(".outputButton"),
      );
    }
    return this.outputElements;
  }
  setOutputActive(i, on) {
    i = parseInt(i, 10) || 0;
    if (this.hideOutputActivityLeds) {
      let el = this.getOutputElements()[i];
      if (!el) return;
      el.classList.toggle("active", !!on);
      return;
    }
    this.ensureOutputLeds();
    let led = this.outputLedElements && this.outputLedElements[i];
    if (!led) return;
    if (!on) {
      led.style.background = "";
      led.style.borderColor = "";
      led.style.boxShadow = "";
    }
    setLed(led, on);
  }

  flashOutput(i, ms) {
    i = parseInt(i, 10) || 0;
    ms = ms != null ? ms : AppConfig.LED_FLASH_MS;
    if (this.hideOutputActivityLeds) {
      let el = this.getOutputElements()[i];
      if (!el) return;
      if (!this._flashOutputTimers) this._flashOutputTimers = {};
      el.classList.add("active");
      clearTimeout(this._flashOutputTimers[i]);
      this._flashOutputTimers[i] = setTimeout(() => {
        el.classList.remove("active");
      }, ms);
      return;
    }
    this.ensureOutputLeds();
    let led = this.outputLedElements && this.outputLedElements[i];
    if (led) flashLedTrig(led, ms);
  }
  createView() {
    if (!this.app) return;
    //THIS WILL WAIT UNTIL THE NODE EXISTS
    if (!this.node) {
      if (this.retryCounter > 200) {
        return console.error("this component has an error in its node", this);
      }
      setTimeout(() => this.createView(), 50);
      this.retryCounter++;
      return; // console.log("###", this.id, this.type, "NODE NOT READY");
    }
    this.node.parent = this;
    this.ready = true;
    this.createInfoButton();
    this.createOutputButton();
    this.createInputButtons();
    this.createWorkletForCustomTriggers();
    this.createWorkletForCustomParams();
    makeChildrenStopPropagation(this.container);
    if (this.serializedData) this.loadFromSerializedData();
    else this.quickSave(true);

    this.putLabels();

    setTimeout(() => {
      if (!this.app || !this.app.patchName) return;
      this.startListeningToChangesInThiscomponent();
    }, 2000);
  }
  // stopListeningToChanges() {
  //   if (this.unsubscribeToFireStore instanceof Function)
  //     this.unsubscribeToFireStore();
  //   this.listeneningToFirestore = false;
  // }

  startListeningToChangesInThiscomponent() {
    if (!this.app.patchName) return;
    if (this.listeneningToFirestore) return;
    this.unsubscribeToFireStore = listenToChangesInComponent(
      this.app.patchName,
      this.id,
      (data) => {
        if (!data) return;
        // console.log("#changes", this.id, data);
        //IF ITS MY CHANGES DONT DO ANYTHING
        if (data.sessionID) {
          if (data.sessionID == this.app.sessionID) return;
        } else if (data.userID == this.app.userID) {
          return;
        }
        this.updateFromSerialized(data);
      },
    );
    this.listeneningToFirestore = true;
  }

  createWorkletForCustomParams() {
    if (!Array.isArray(this.customAudioParams)) return;

    this.app
      .loadWorklet("js/audioWorklets/customAudioParamsWorklet.js")
      .then(() => {
        this.customAudioParamsWorkletNode = this.app.makeWorklet(
          "custom-params-worklet",
          {
            numberOfInputs: this.customAudioParams.length,
            numberOfOutputs: 0,
          },
        );
        this.paramsSab = this.customAudioParamsWorkletNode._sabBlock;
        this.addAudioProfileKey("custom-params");

        this.customAudioParamsWorkletNode.onprocessorerror = (e) => {
          console.error(e);
        };
        this.customAudioParamsWorkletNode.parent = this;
      });
  }

  createWorkletForCustomTriggers() {
    if (!Array.isArray(this.customAudioTriggers)) return;

    this.app.loadWorklet("js/audioWorklets/triggerWorklet.js").then(() => {
      this.customAudioTriggersWorkletNode = this.app.makeWorklet(
        "trigger-worklet",
        {
          numberOfInputs: this.customAudioTriggers.length,
          numberOfOutputs: 0,
        },
      );
      this.trigSab = this.customAudioTriggersWorkletNode._sabBlock;
      this.addAudioProfileKey("trigger");

      this.customAudioTriggersWorkletNode.onprocessorerror = (e) => {
        console.error(e);
      };
      this.customAudioTriggersWorkletNode.parent = this;
    });
  }

  /** Channel index on jackActivityNode, or -1 */
  jackActivityChannel(audioParam) {
    if (!audioParam || !this.jackActivityNames) return -1;
    let name = this.resolveJackName(audioParam);
    return this.jackActivityNames.indexOf(name);
  }

  /** Normalize jack / AudioParam name (override in subclasses if needed). */
  resolveJackName(name) {
    return name;
  }

  getJackKind(name) {
    name = this.resolveJackName(name);
    if (this.jackKinds && this.jackKinds[name]) return this.jackKinds[name];
    if ((this.customAudioTriggers || []).includes(name)) return "trig";
    if (name == "gate") return "gate";
    if (
      name == "trigger" ||
      name == "clock" ||
      name == "reset" ||
      name == "stop"
    ) {
      return "trig";
    }
    if (String(name).startsWith("in_")) return "audio";
    if ((this.namedAudioInputs || []).includes(name)) return "audio";
    return "cv";
  }

  isTrigOrGateJack(name) {
    let kind = this.getJackKind(name);
    return kind == "trig" || kind == "gate";
  }

  getOutputKind(i) {
    i = parseInt(i, 10) || 0;
    if (this.outputKinds && this.outputKinds[i] != null) {
      return this.outputKinds[i];
    }
    if (this.outputKinds && this.outputKinds[String(i)] != null) {
      return this.outputKinds[String(i)];
    }
    let label = ((this.outputLabels || [])[i] || "").toLowerCase();
    if (
      label == "trigger" ||
      label.indexOf("trig") >= 0 ||
      label == "clock" ||
      label == "reset"
    ) {
      return "trig";
    }
    if (label == "gate") return "gate";
    return "cv";
  }

  applyInputLed(name, level) {
    let led = this.inputElements[name] && this.inputElements[name].led;
    if (!led) return;
    let kind = this.getJackKind(name);
    if (kind == "trig") {
      if (!this._jackLedOn) this._jackLedOn = {};
      let on = this._jackLedOn[name] || 0;
      let next = AppConfig.schmitt(on, level);
      if (next && !on) flashLedTrig(led, AppConfig.LED_FLASH_MS);
      this._jackLedOn[name] = next;
    } else {
      setLedBipolar(led, level);
    }
  }

  setOutputLed(i, level, kind) {
    i = parseInt(i, 10) || 0;
    if (!this.outputLedElements) this.ensureOutputLeds();
    let led = this.outputLedElements && this.outputLedElements[i];
    if (!led) return;
    kind = kind || this.getOutputKind(i);
    if (kind == "trig") {
      if (!this._outLedOn) this._outLedOn = {};
      let on = this._outLedOn[i] || 0;
      let next = AppConfig.schmitt(on, level);
      if (next && !on) flashLedTrig(led, AppConfig.LED_FLASH_MS);
      this._outLedOn[i] = next;
    } else {
      setLedBipolar(led, level);
    }
  }

  clearOutputLedIfIdle(outIndex) {
    outIndex = parseInt(outIndex, 10) || 0;
    let still = (this.connections || []).some(
      (c) => parseInt(c.numberOfOutput, 10) == outIndex,
    );
    this.syncOutputConnected(outIndex);
    if (still) return;
    if (!this.outputLedElements) return;
    let led = this.outputLedElements[outIndex];
    if (led) setLedBipolar(led, 0);
    if (this._outLedOn) this._outLedOn[outIndex] = 0;
  }

  syncOutputConnected(outIndex) {
    outIndex = parseInt(outIndex, 10) || 0;
    let outs = this.getOutputElements();
    let btn = outs[outIndex];
    if (!btn) return;
    let has = (this.connections || []).some(
      (c) => parseInt(c.numberOfOutput, 10) == outIndex,
    );
    btn.classList.toggle("connected", has);
  }

  ensureOutputLeds() {
    if (this.hideOutputActivityLeds) return;
    if (!this.outputLedElements) this.outputLedElements = [];
    let outs = this.getOutputElements();
    for (let i = 0; i < outs.length; i++) {
      if (this.outputLedElements[i]) continue;
      let btn = outs[i];
      if (!btn || !btn.parentElement) continue;
      let wrap = btn.parentElement;
      if (!wrap.classList || !wrap.classList.contains("outputJackRow")) {
        wrap = document.createElement("div");
        wrap.className = "outputJackRow";
        btn.parentElement.insertBefore(wrap, btn);
        wrap.appendChild(btn);
      }
      let lab = wrap.querySelector(".jack-label");
      if (!lab) {
        lab = document.createElement("span");
        lab.className = "jack-label";
        wrap.insertBefore(lab, wrap.firstChild);
      }
      let led = wrap.querySelector(".ui-led");
      if (!led && !this.hideOutputActivityLeds) {
        led = createLed();
        wrap.insertBefore(led, btn);
      }
      if (led) this.outputLedElements[i] = led;
    }
  }

  mirrorLevelsToSources(jackName, level) {
    if (!this.app || !this.app.getAllConnections) return;
    jackName = this.resolveJackName(jackName);
    // key: fromId|outIdx -> best level by |v|
    if (!this._mirrorAcc) this._mirrorAcc = Object.create(null);
    for (let conn of this.app.getAllConnections()) {
      if (conn.to !== this) continue;
      let destJack =
        (this.resolveJackName && this.resolveJackName(conn.audioParam)) ||
        conn.audioParam;
      if (destJack !== jackName) continue;
      let from = conn.from;
      if (!from || !from.setOutputLed) continue;
      let oi = parseInt(conn.numberOfOutput, 10) || 0;
      let key = from.id + "|" + oi;
      let prev = this._mirrorAcc[key];
      if (!prev || Math.abs(level) >= Math.abs(prev.level)) {
        this._mirrorAcc[key] = { from, oi, level };
      }
    }
  }

  flushMirrorAcc() {
    if (!this._mirrorAcc) return;
    for (let key in this._mirrorAcc) {
      let { from, oi, level } = this._mirrorAcc[key];
      from.setOutputLed(oi, level, from.getOutputKind(oi));
      delete this._mirrorAcc[key];
    }
  }

  tickJackLedsFromSab() {
    let names = this.jackActivityNames;
    if (!names || !names.length) return;
    if (!this._mirrorAcc) this._mirrorAcc = Object.create(null);
    if (this.jackActivityNode && this.jackActivityNode._sabBlock) {
      let sab = this.jackActivityNode._sabBlock;
      let seq = sab.seq();
      if (seq === this._jackSabSeq) return;
      this._jackSabSeq = seq;
      for (let i = 0; i < names.length; i++) {
        let level = sab.getSlot(i);
        this.applyInputLed(names[i], level);
        this.mirrorLevelsToSources(names[i], level);
      }
      this.flushMirrorAcc();
      return;
    }
    if (!this._selfPeaks || !this.sabBlock) return;
    let sab = this.sabBlock;
    let seq = sab.seq();
    if (seq === this._jackSabSeq) return;
    this._jackSabSeq = seq;
    let nIn = this.node ? this.node.numberOfInputs : 0;
    let paramKeys = this._peakParamKeys;
    if (!paramKeys) {
      paramKeys = [];
      if (this.node && this.node.parameters) {
        this.node.parameters.forEach((_p, name) => paramKeys.push(name));
      }
      this._peakParamKeys = paramKeys;
    }
    for (let i = 0; i < names.length; i++) {
      let name = names[i];
      let idx;
      if (String(name).indexOf("in_") === 0) {
        idx = AppConfig.SAB_SLOT_PEAK0 + (parseInt(name.slice(3), 10) || 0);
      } else {
        let pi = paramKeys.indexOf(name);
        if (pi < 0) continue;
        idx = AppConfig.SAB_SLOT_PEAK0 + nIn + pi;
      }
      let level = sab.getSlot(idx);
      this.applyInputLed(name, level);
      this.mirrorLevelsToSources(name, level);
    }
    this.flushMirrorAcc();
  }

  onSabTick() {
    this.drainParamSab();
    this.drainTrigSab();
  }

  drainParamSab() {
    let sab = this.paramsSab;
    if (!sab || !this.customAudioParams) return;
    if (!this._paramPrev) this._paramPrev = [];
    let n = this.customAudioParams.length;
    for (let p = 0; p < n; p++) {
      let current = sab.getSlot(p);
      if (this._paramPrev[p] === undefined) {
        this._paramPrev[p] = current;
        continue;
      }
      if (this._paramPrev[p] === current) continue;
      let lastVal = this._paramPrev[p];
      this._paramPrev[p] = current;
      if (this.handleCustomAudioParamChanged instanceof Function) {
        this.handleCustomAudioParamChanged({
          channelTriggered: p,
          lastVal,
          current,
        });
      }
    }
  }

  drainTrigSab() {
    let sab = this.trigSab;
    if (!sab || !this.customAudioTriggers) return;
    if (!this._trigPrev) this._trigPrev = [];
    let n = this.customAudioTriggers.length;
    for (let p = 0; p < n; p++) {
      let count = sab.getSlot(p);
      if (this._trigPrev[p] === undefined) {
        this._trigPrev[p] = count;
        continue;
      }
      if (this._trigPrev[p] === count) continue;
      this._trigPrev[p] = count;
      if (this.handleTriggerFromWorklet instanceof Function) {
        this.handleTriggerFromWorklet({
          channelTriggered: p,
          lastVal: 0,
          current: 1,
        });
      }
    }
  }

  createJackActivityMonitor() {
    if (this.jackActivityNode || this._selfPeaks) return;
    let names = this.jackActivityNames || [];
    if (!names.length) {
      names = Object.keys(this.inputElements || {}).filter(
        (n) => this.inputElements[n] && this.inputElements[n].led,
      );
      this.jackActivityNames = names;
    }
    if (!names.length) return;

    if (this.node instanceof AudioWorkletNode) {
      this._selfPeaks = true;
      return;
    }

    this.app.loadWorklet("js/audioWorklets/jackActivityWorklet.js").then(() => {
      if (this.jackActivityNode || !this.app || this._selfPeaks) return;
      let n = (this.jackActivityNames || []).length;
      if (!n) return;
      this.jackActivityNode = this.app.makeWorklet("jack-activity-worklet", {
        numberOfInputs: n,
        numberOfOutputs: 0,
      });
      this.addAudioProfileKey("jack-activity");
      this.jackActivityNode.onprocessorerror = (e) => {
        console.error(e);
      };
      if (this.app && this.app.getAllConnections) {
        for (let c of this.app.getAllConnections()) {
          if (c.to === this && c.reset) c.reset();
        }
      }
    });
  }

  createInputButtons() {
    if (
      this.type == "Mouse" ||
      this.type == "WebRTCReceiver"
      //|| this.type == "Drawer"
    )
      return;
    // console.log("CREATING BUTTONS FOR", this.type, this.id);

    //AUDIOPARAMS FROM THE NODE
    this.audioParams = Object.keys(Object.getPrototypeOf(this.node)).filter(
      (k) => this.node[k] instanceof AudioParam,
    );

    //AUDIO INPUTS
    for (let i = 0; i < this.node.numberOfInputs; i++) {
      this.audioParams.push("in_" + i);
    }
    for (let key of Object.keys(this.node)) {
      if (key == "parent" || key.charAt(0) == "_") continue;
      if (this.node[key] instanceof AudioParam) this.audioParams.push(key);
    }
    if (this.node.parameters) {
      //IT'S AN AUDIO WORKLET NODE
      this.node.parameters.forEach((audioParam, name) => {
        this.audioParams.push(name);
      });
    }

    this.audioParams = unique(this.audioParams);

    // Audio inputs (in_N) first, then params / triggers
    let ordered = [
      ...this.audioParams.filter((p) => String(p).startsWith("in_")),
      ...this.audioParams.filter((p) => !String(p).startsWith("in_")),
      ...(this.namedAudioInputs || []),
      ...(this.customAudioTriggers || []),
      ...(this.customAudioParams || []),
    ];

    this.jackActivityNames = [];

    for (let inp of ordered) {
      if (String(inp).charAt(0) == "_") continue;
      if (inp == "in_0" && this.type == "Multiplexor") {
        //INPUT 0 DOESNT WORK, I USE 0 TO INDICATE THE MULTIPLEXOR HAS TO REMEMBER ITS LAST STATE
        continue;
      }
      let widgetMode =
        (this.uiParamWidgets && this.uiParamWidgets[inp]) || "knob";
      // Module owns its own UI for this jack (e.g. Mixer channel strips)
      if (widgetMode === "none") continue;

      let audioParamRow = document.createElement("audioParamRow");
      audioParamRow.classList.add("jack-row");

      let led = createLed();
      let button = document.createElement("button");
      button.onclick = (e) => this.onAudioParamClicked(inp);
      button.classList.add("input", "jack");
      button.classList.add(inp);
      button.title = inp;
      button.type = "button";
      button.setAttribute("aria-label", inp);

      let label = document.createElement("span");
      label.className = "jack-label";
      label.textContent = inp;

      let textInput;
      let knob;
      let isAudioParam =
        !inp.startsWith("in") &&
        !(this.namedAudioInputs || []).includes(inp) &&
        !(this.customAudioTriggers || []).includes(inp) &&
        !(this.customAudioParams || []).includes(inp);

      if (isAudioParam && widgetMode !== "fader" && !this.isTrigOrGateJack(inp)) {
        let limits = this.getParamInputLimits(inp);
        let currentVal = 0;
        if (this.node.parameters && this.node.parameters.get(inp)) {
          currentVal = this.node.parameters.get(inp).value;
        } else if (this.node[inp]) {
          currentVal = this.node[inp].value;
        }
        let useLog =
          inp === "frequency" ||
          inp === "baseHz" ||
          inp === "detune" ||
          inp === "cutoff" ||
          (inp === "gain" && limits.max > 10);
        knob = createKnob({
          min: limits.min,
          max: limits.max,
          step: limits.step,
          value: currentVal,
          log: useLog,
          label: "",
          onChange: (val) => {
            if (this.node?.parameters?.get(inp)) {
              this.node.parameters.get(inp).value = val;
            } else if (this.node[inp]) {
              this.node[inp].value = val;
            }
            this.quickSave();
          },
        });
        textInput = knob.field;
        textInput.classList.add(inp);
      }

      this.inputElements[inp] = { button, textInput, knob, led };
      if (this.jackActivityNames.indexOf(inp) < 0) {
        this.jackActivityNames.push(inp);
      }

      audioParamRow.appendChild(button);
      audioParamRow.appendChild(led);
      audioParamRow.appendChild(label);
      if (knob) audioParamRow.appendChild(knob.el);
      this.inputsDiv.appendChild(audioParamRow);
    }

    this.createJackActivityMonitor();
  }

  getParamInputLimits(name) {
    if (name == "frequency" || name == "detune" || name == "baseHz" || name == "cutoff") {
      return { min: 0, max: 20000, step: 0.1 };
    }
    if (name == "Q") {
      return { min: 0.0001, max: 100, step: 0.01 };
    }
    if (name == "gain") {
      return { min: 0, max: 100000, step: 0.01 };
    }
    if (name == "delayTime") {
      return { min: 0, max: 1, step: 0.001 };
    }
    if (name == "time") {
      return { min: 0.0001, max: 10, step: 0.001 };
    }
    if (name == "rate") {
      return { min: 0, max: 10, step: 0.01 };
    }
    if (name == "offset") {
      return { min: -1000, max: 1000, step: 0.01 };
    }
    return { min: 0, step: 0.01 };
  }

  onParamChanged(event, param) {
    event.stopPropagation();
    let val = Number(event.target.value);
    if (this.node?.parameters?.get(param)) {
      this.node.parameters.get(param).value = val;
    } else {
      this.node[param].value = val;
    }
    this.quickSave();
  }
  onAudioParamClicked(audioParam) {
    if (this.inputElements[audioParam].button.classList.contains("connected")) {
      //DISCONNECTING...
      let componentFromWhichThisConnectionComes = Connection.getComponentFrom(
        this,
        audioParam,
      );
      this.disconnect(audioParam);
      setTimeout(() => componentFromWhichThisConnectionComes.quickSave(), 10);
      if ((this.customAudioParams || []).includes(audioParam)) {
        //THIS IS A CUSTOM AUDIO PARAM THAT WAS CLICKED
        this.handleCustomAudioParamChanged({ current: 0 });
      }
    } else {
      if (!this.app.lastOutputClicked) return;

      let numberOfOutput =
        this.app.lastOutputClicked.output.getAttribute("numberOfOutput");

      this.app.lastOutputClicked.compo.connect(
        this,
        audioParam,
        numberOfOutput,
      );
      if ((this.customAudioParams || []).includes(audioParam)) {
        //THIS IS A CUSTOM AUDIO PARAM THAT WAS CLICKED
        this.resetAudioParams();
      }

      this.app.lastOutputClicked.compo.quickSave();
      this.app.clearCableGhost();
    }
  }
  resetAudioParams() {
    if (this.paramsSab) this.paramsSab.setNote(1);
  }
  createInfoButton() {
    if (!this.infoText) return;
    this.infoButton = document.createElement("button");
    this.infoButton.classList.add("infoButton");
    this.infoButton.innerText = "?";
    this.infoButton.title = "Component Info";
    this.infoButton.onclick = () => {
      this.app.showMessage(this.infoText);
    };
    if (this.headerRight) {
      this.headerRight.insertBefore(
        this.infoButton,
        this.headerRight.firstChild,
      );
    } else {
      this.container.appendChild(this.infoButton);
    }
  }
  createIcon() {
    this.icon = document.createElement("icon");
    if (this.headerLeft) {
      this.headerLeft.insertBefore(this.icon, this.headerLeft.firstChild);
    } else {
      this.container.appendChild(this.icon);
    }
  }
  disconnect(audioParam) {
    this.app.removeConnectionToMe(this, audioParam);
    this.app.updateAllLines();
  }

  clearAll() {
    this.container.innerHTML = "";
    Object.keys(this).forEach((k) => {
      this[k] = undefined;
      delete this[k];
    });
    // this=null
  }

  resetMyConnections() {
    for (let c of this.connections) {
      c.reset();
    }

    this.app.components.map((k) =>
      k.connections.map((c) => {
        if (c.to == this) {
          c.reset();
        }
      }),
    );
  }

  disposeAudio() {
    let nodes = [
      this.node,
      this.customAudioParamsWorkletNode,
      this.customAudioTriggersWorkletNode,
      this.jackActivityNode,
      this.silentGain,
    ];
    for (let n of nodes) {
      if (!n || typeof n.disconnect !== "function") continue;
      try {
        n.disconnect();
      } catch (e) {}
    }
  }

  addAudioProfileKey(key) {
    if (!key) return;
    if (!this.audioProfileKeys) this.audioProfileKeys = [];
    if (this.audioProfileKeys.indexOf(key) < 0) this.audioProfileKeys.push(key);
  }

  remove() {
    if (this.unsubscribeToFireStore instanceof Function)
      this.unsubscribeToFireStore();
    this.app.removeAllConnections(this);
    this.disposeAudio();
    this.container.parentElement.removeChild(this.container);

    this.app.components = this.app.components.filter((c) => c != this);
    this.app.afterEdit();
    if (this.app.patchName) {
      removeComponentFromFirestore(this.app.patchName, this.id);
      this.app.saveListOfComponentsInFirestore();
    }

    setTimeout(() => {
      this.app.updateAllLines();
      this.clearAll();
    }, 50);
  }
  connect(compo, input, numberOfOutput) {
    numberOfOutput = parseInt(numberOfOutput);
    if (isNaN(numberOfOutput)) numberOfOutput = 0;
    for (let existing of this.connections) {
      if (
        existing.to == compo &&
        existing.audioParam == input &&
        parseInt(existing.numberOfOutput) == numberOfOutput
      ) {
        return;
      }
    }

    let conn = new Connection(this, compo, input, numberOfOutput, this.app);
    let jackName =
      (compo.resolveJackName && compo.resolveJackName(input)) || input;
    try {
      compo.inputElements[jackName].button.classList.add("connected");
    } catch (e) {
      console.log(e);
    }
    this.connections.push(conn);

    let where = figureOutWhereToConnect(this, compo, input, conn);

    try {
      where.whichInput
        ? this.node.connect(
            where.whereToConnect,
            numberOfOutput,
            where.whichInput,
          )
        : this.node.connect(where.whereToConnect, numberOfOutput);
    } catch (e) {
      console.warn(e);
    }

    let actCh =
      compo.jackActivityChannel && compo.jackActivityChannel(jackName);
    if (compo.jackActivityNode && actCh >= 0) {
      try {
        this.node.connect(compo.jackActivityNode, numberOfOutput, actCh);
      } catch (e) {}
    }

    this.syncOutputConnected(numberOfOutput);
    conn.redraw();
  }

  isDragIgnoreTarget(el) {
    return !!el.closest("button, input, select, textarea, outputs, canvas");
  }

  onPointerDown(e) {
    if (e.button != 0) return;
    if (this.isDragIgnoreTarget(e.target)) return;
    e.stopPropagation();
    e.preventDefault();
    this.toggleActive();
    let s = this.app.scale || 1;
    let el = this.container.getBoundingClientRect();
    this._dragging = true;
    this._grabX = (e.clientX - el.left) / s;
    this._grabY = (e.clientY - el.top) / s;
    this.container.classList.add("grabbed");
    this.container.style.setProperty(
      "--grab-hue",
      this.app.hueFromUserId(this.app.userID),
    );
    this.container.setPointerCapture(e.pointerId);
  }

  onPointerMove(e) {
    if (!this._dragging) return;
    this._dragClientX = e.clientX;
    this._dragClientY = e.clientY;
    // Apply once per cable rAF — avoids layout thrash every pointer event
    this.app._pendingDragComp = this;
  }

  onPointerUp(e) {
    if (!this._dragging) return;
    if (this.app._pendingDragComp === this) {
      this.app.cacheRackRect();
      this.app.flushPendingComponentDrag();
    }
    this._dragging = false;
    this.container.classList.remove("grabbed");
    this.container.style.removeProperty("--grab-hue");
    let x = parseFloat(this.container.style.left) || 0;
    let y = parseFloat(this.container.style.top) || 0;
    if (!this.app.syncingRemote) {
      this.app.broadcastLocalDrag(this.id, x, y, true);
    }
    this.quickSave();
    this.app.updateAllLines();
  }

  createContainer() {
    this.container = document.createElement("component");
    this.container.component = this;
    this.container.draggable = false;
    this.container.addEventListener("pointerdown", (e) =>
      this.onPointerDown(e),
    );
    this.container.addEventListener("pointermove", (e) =>
      this.onPointerMove(e),
    );
    this.container.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.container.addEventListener("pointercancel", (e) =>
      this.onPointerUp(e),
    );

    if ((this.serializedData || {}).x && (this.serializedData || {}).y) {
      this.container.style.left = this.serializedData.x;
      this.container.style.top = this.serializedData.y;
    } else {
      if (this.type.toLowerCase() == "output") {
        this.container.style.left =
          Math.floor(window.innerWidth * 0.5) + 500 + "px";
        this.container.style.top =
          Math.floor(window.innerHeight * 0.5) + 500 + "px";
      } else {
        this.container.style.left =
          Math.floor((window.innerWidth - 400) * Math.random() + 200) -
          this.app.container.getBoundingClientRect().x +
          "px";
        this.container.style.top =
          Math.floor((window.innerHeight - 500) * Math.random() + 250) -
          this.app.container.getBoundingClientRect().y +
          "px";
      }
    }

    this.app.container.appendChild(this.container);

    this.container.classList.add(this.type);
    let tone = (App.COMPONENT_TONE && App.COMPONENT_TONE[this.type]) || "meta";
    this.container.classList.add("tone-" + tone);

    // Header bar
    this.header = document.createElement("div");
    this.header.classList.add("component-header");
    this.container.appendChild(this.header);

    this.headerLeft = document.createElement("div");
    this.headerLeft.classList.add("header-left");
    this.header.appendChild(this.headerLeft);

    this.titleElement = document.createElement("span");
    this.titleElement.classList.add("component-title");
    this.titleElement.innerText = this.constructor.name;
    this.headerLeft.appendChild(this.titleElement);

    this.headerRight = document.createElement("div");
    this.headerRight.classList.add("header-right");
    this.header.appendChild(this.headerRight);

    // Body container
    this.body = document.createElement("div");
    this.body.classList.add("component-body");
    this.container.appendChild(this.body);

    this.inputsDiv = document.createElement("div");
    this.inputsDiv.classList.add("inputsDiv");
    this.body.appendChild(this.inputsDiv);

    // Unique module UI (canvas, grid, faders…) — always append here, not container
    this.main = document.createElement("div");
    this.main.classList.add("component-main");
    this.body.appendChild(this.main);

    if (this.createdBy == this.app.userID) {
      this.container.classList.add("mine");
    }
  }
  isThisComponentMine() {
    return this.createdBy == this.app.userID;
  }

  createSeatSelect() {
    this.sourceUserID =
      (this.serializedData && this.serializedData.sourceUserID) ||
      this.sourceUserID ||
      this.app.userID;
    if (!Array.isArray(this.valuesToSave)) this.valuesToSave = [];
    if (this.valuesToSave.indexOf("sourceUserID") < 0) {
      this.valuesToSave.push("sourceUserID");
    }
    this.seatSelect = document.createElement("select");
    this.seatSelect.classList.add("seatSelect");
    this.seatSelect.title = "Whose device feeds this module";
    this.seatSelect.onclick = (e) => e.stopPropagation();
    this.seatSelect.onchange = () => {
      let prev = this.sourceUserID;
      this.sourceUserID = this.seatSelect.value;
      if (this.onSeatChanged instanceof Function) {
        this.onSeatChanged(prev, this.sourceUserID);
      }
      this.quickSave();
    };
    if (this.main) {
      this.main.appendChild(this.seatSelect);
    } else if (this.body) {
      this.body.appendChild(this.seatSelect);
    } else {
      this.container.appendChild(this.seatSelect);
    }
    this.refreshSeatSelect();
  }

  refreshSeatSelect() {
    if (!this.seatSelect) return;
    let online = new Set([this.app.userID]);
    for (let u of this.app.connectedUsers || []) {
      if (u && u.userID) online.add(u.userID);
    }
    let ids = new Set(online);
    for (let c of this.app.components || []) {
      if (c && c.sourceUserID) ids.add(c.sourceUserID);
    }
    if (this.sourceUserID) ids.add(this.sourceUserID);
    this.seatSelect.innerHTML = "";
    for (let id of ids) {
      let opt = document.createElement("option");
      opt.value = id;
      if (id == this.app.userID) {
        opt.textContent = "You (" + id + ")";
      } else if (!online.has(id)) {
        opt.textContent = id + " (offline)";
      } else {
        opt.textContent = id;
      }
      if (id == this.sourceUserID) opt.selected = true;
      this.seatSelect.appendChild(opt);
    }
  }

  isLocalSeat() {
    return this.sourceUserID == this.app.userID;
  }

  toggleActive() {
    if (this.active) {
      for (let c of this.app.components) {
        c.active = false;
        c.container.classList.remove("active");
      }
      this.active = false;
    } else {
      for (let c of this.app.components) {
        c.active = false;
        c.container.classList.remove("active");
      }
      this.container.classList.add("active");
      this.active = true;
    }
  }
  createDisplay() {
    this.displayWrap = document.createElement("div");
    this.displayWrap.classList.add("ui-display");
    this.displayLed = createLed();
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.displayWrap.appendChild(this.displayLed);
    this.displayWrap.appendChild(this.display);
    (this.main || this.body || this.container).appendChild(this.displayWrap);
  }

  updateBPM() {}

  applyClockSkew(_skew) {}

  createOutputButton() {
    if (
      this.type.toLowerCase() == "output" ||
      this.type.toLowerCase() == "imagemaker" ||
      this.type.toLowerCase() == "canvasplotter" ||
      this.type.toLowerCase() == "shader" ||
      this.type.toLowerCase() == "numberdisplaycomponent" ||
      this.type.toLowerCase() == "visualizer" ||
      this.type.toLowerCase() == "frequencyanalizer"
    ) {
      return;
    }
    this.outputs = document.createElement("outputs");
    (this.body || this.container).appendChild(this.outputs);
    this.outputLedElements = [];

    for (let i = 0; i < (this.node || {}).numberOfOutputs; i++) {
      let row = document.createElement("div");
      row.className = "outputJackRow";
      let label = document.createElement("span");
      label.className = "jack-label";
      label.textContent = (this.outputLabels && this.outputLabels[i]) || "";
      let outputButton = document.createElement("input");
      outputButton.type = "checkbox";
      outputButton.classList.add("outputButton", "jack");
      outputButton.setAttribute("numberOfOutput", i);
      outputButton.onclick = (e) => {
        this.onOutputClicked(e, outputButton);
      };
      row.appendChild(label);
      if (!this.hideOutputActivityLeds) {
        let led = createLed();
        row.appendChild(led);
        this.outputLedElements[i] = led;
      }
      row.appendChild(outputButton);
      this.outputs.appendChild(row);
    }
    this.outputElements = null;
  }
  onOutputClicked(e, outputButton) {
    e.preventDefault();
    e.stopPropagation();
    this.app.lastOutputClicked = { compo: this, output: outputButton };
    this.app._cableMouseClient.x = e.clientX;
    this.app._cableMouseClient.y = e.clientY;
  }
  updateFromSerialized(other) {
    if (!this.container || !this.app) return;
    if (other instanceof Component) {
      this.serializedData = other.serialize();
    } else {
      this.serializedData = other;
    }

    this.loadFromSerializedData();
  }

  serialize() {
    let obj = {
      id: this.id,
      audioParams: {},
      type: this.type,
      constructor: this.type,
      node: {},
    };
    // if (this.formula) {
    //   obj.formula = this.formula;
    // }
    if ((this.node || {}).type) {
      obj.node.type = this.node.type;
    }
    for (let audioParam of this.audioParams || []) {
      if (audioParam.startsWith("in")) continue;
      if (this.isTrigOrGateJack(audioParam)) continue;
      let param = this.node && this.node[audioParam];
      if (!(param instanceof AudioParam) && this.node?.parameters) {
        param = this.node.parameters.get(audioParam);
      }
      if (param instanceof AudioParam) {
        obj.audioParams[audioParam] = param.value;
      }
    }
    obj.audioParams = sortObjectKeysAlphabetically(obj.audioParams);
    if (Array.isArray(this.valuesToSave)) {
      for (let key of this.valuesToSave) {
        if (this[key] != null) obj[key] = this[key];
      }
      obj.valuesToSave = this.valuesToSave.sort();
    }
    obj.x = this.container.style.left;
    obj.y = this.container.style.top;

    obj.createdBy = this.createdBy;

    obj.connections = this.connections.map((k) => k.serialize());

    return sortObjectKeysAlphabetically(obj);
  }
  waitAndSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.quickSave();
    }, 200);
  }

  areMycustomTriggersAndParamsWorkletsReady() {
    let triggersReady = false;
    if (Array.isArray(this.customAudioTriggers)) {
      triggersReady = !!this.customAudioTriggersWorkletNode;
    } else {
      triggersReady = true;
    }

    let paramsReady = false;
    if (Array.isArray(this.customAudioParams)) {
      paramsReady = !!this.customAudioParamsWorkletNode;
    } else {
      paramsReady = true;
    }

    return triggersReady && paramsReady;
  }

  waitUntilImReady(cb, counter) {
    if (!counter) counter = 1;
    else counter++;

    if (!this.amIReady())
      setTimeout(() => {
        this.waitUntilImReady(cb, counter);
      }, 25);
    else cb();
  }

  amIReady() {
    return this.ready && this.areMycustomTriggersAndParamsWorkletsReady();
  }
}
