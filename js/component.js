class Component {
  constructor(app, serializedData) {
    this.app = app;
    this.type = this.constructor.name;
    this.serializedData = serializedData;
    this.createdBy = (this.serializedData || {}).createdBy
      ? (this.serializedData || {}).createdBy
      : this.app.userID;
    this.audioParams = [];
    this.retryCounter = 0;
    this.connections = [];
    this.running = false;
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
  createDeleteButton() {
    if (!this.isThisComponentMine()) return;
    this.deleteButton = document.createElement("button");
    this.deleteButton.classList.add("deleteButton");
    this.container.appendChild(this.deleteButton);
    this.deleteButton.innerHTML = "🗑️";
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
      serializedMe
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
    if (!this.serializedData) return;

    if (this.node && this.serializedData.audioParams) {
      let keys = Object.keys(this.serializedData.audioParams);
      for (let key of keys) {
        if (key.startsWith("in")) continue;
        let val = this.serializedData.audioParams[key];
        let param = this.node[key];
        if (!(param instanceof AudioParam) && this.node.parameters) {
          param = this.node.parameters.get(key);
        }
        if (param instanceof AudioParam) {
          param.value = val;
        }
        let inputEl = this.inputElements[key];
        if (inputEl && inputEl.textInput) {
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
          doWeHaveToUpdateLines
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
    let arr = Array.from(this.container.querySelectorAll(".outputButton"));
    for (let i = 0; i < this.outputLabels.length; i++) {
      let elem = arr[i];

      elem.style.setProperty("--label", "'" + this.outputLabels[i] + "'");
    }
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
        if (
          data.sessionID != this.app.sessionID &&
          data.userID != this.app.userID
        ) {
          this.updateFromSerialized(data);
        } else {
          // console.warn("## your own changes", this.type, this.id);
        }
      }
    );
    this.listeneningToFirestore = true;
  }

  createWorkletForCustomParams() {
    if (!Array.isArray(this.customAudioParams)) return;

    this.app.loadWorklet("js/audioWorklets/customAudioParamsWorklet.js")
      .then(() => {
        this.customAudioParamsWorkletNode = new AudioWorkletNode(
          this.app.actx,
          "custom-params-worklet",
          {
            numberOfInputs: this.customAudioParams.length,
            numberOfOutputs: 0,
          }
        );

        this.customAudioParamsWorkletNode.onprocessorerror = (e) => {
          console.error(e);
        };
        this.customAudioParamsWorkletNode.parent = this;
        this.customAudioParamsWorkletNode.port.onmessage = (e) => {
          if (this.handleCustomAudioParamChanged instanceof Function)
            this.handleCustomAudioParamChanged(e.data);
        };
      });
  }

  createWorkletForCustomTriggers() {
    if (!Array.isArray(this.customAudioTriggers)) return;

    this.app.loadWorklet("js/audioWorklets/triggerWorklet.js")
      .then(() => {
        this.customAudioTriggersWorkletNode = new AudioWorkletNode(
          this.app.actx,
          "trigger-worklet",
          {
            numberOfInputs: this.customAudioTriggers.length,
            numberOfOutputs: 0,
          }
        );

        this.customAudioTriggersWorkletNode.onprocessorerror = (e) => {
          console.error(e);
        };
        this.customAudioTriggersWorkletNode.parent = this;
        this.customAudioTriggersWorkletNode.port.onmessage = (e) => {
          if (this.handleTriggerFromWorklet instanceof Function)
            this.handleTriggerFromWorklet(e.data);
        };
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
      (k) => this.node[k] instanceof AudioParam
    );

    //AUDIO INPUTS
    for (let i = 0; i < this.node.numberOfInputs; i++) {
      this.audioParams.push("in_" + i);
    }
    //AUDIO WORKLETS WITH PARAMETERS BEHAVE THIS WAY:
    for (let key of Object.keys(this.node)) {
      if (key != "parent") this.audioParams.push(key);
    }
    if (this.node.parameters) {
      //IT'S AN AUDIO WORKLET NODE
      this.node.parameters.forEach((audioParam, name) => {
        this.audioParams.push(name);
      });
    }

    this.audioParams = unique(this.audioParams);

    for (let inp of [
      ...this.audioParams,
      ...(this.customAudioTriggers || []),
      ...(this.customAudioParams || []),
    ]) {
      // if ((inp == "gain" || inp == "detune") && this.type != "Amp")   continue;
      if (inp == "in_0" && this.type == "Multiplexor") {
        //INPUT 0 DOESNT WORK, I USE 0 TO INDICATE THE MULTIPLEXOR HAS TO REMEMBER ITS LAST STATE
        continue;
      }
      //CREATE THE ROW
      let audioParamRow = document.createElement("audioParamRow");
      //CREATE THE BUTTON
      let button = document.createElement("button");
      button.onclick = (e) => this.onAudioParamClicked(inp);
      button.classList.add("input");
      button.classList.add(inp);
      button.title = inp;
      button.innerText = inp;

      let textInput;
      //AUDIO INPUTS DON'T HAVE A TEXT TO SET THEM, DAAH
      if (
        !inp.startsWith("in") &&
        !(this.customAudioTriggers || []).includes(inp) &&
        !(this.customAudioParams || []).includes(inp)
      ) {
        textInput = document.createElement("input");
        textInput.classList.add(inp);
        textInput.type = "number";
        textInput.onchange = (e) => this.onParamChanged(e, inp);
        textInput.onkeydown = (e) => e.stopImmediatePropagation();
        let limits = this.getParamInputLimits(inp);
        if (limits.min != null) textInput.min = limits.min;
        if (limits.max != null) textInput.max = limits.max;
        textInput.step = limits.step;
        let currentVal = 0;
        if (this.node.parameters && this.node.parameters.get(inp)) {
          currentVal = this.node.parameters.get(inp).value;
        } else if (this.node[inp]) {
          currentVal = this.node[inp].value;
        }
        textInput.value = currentVal.toString();
      }

      this.inputElements[inp] = { button, textInput };

      audioParamRow.appendChild(button);
      if (textInput) audioParamRow.appendChild(textInput);
      this.inputsDiv.appendChild(audioParamRow);
    }
  }

  getParamInputLimits(name) {
    if (name == "frequency" || name == "detune" || name == "baseHz") {
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
        audioParam
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
        numberOfOutput
      );
      if ((this.customAudioParams || []).includes(audioParam)) {
        //THIS IS A CUSTOM AUDIO PARAM THAT WAS CLICKED
        this.resetAudioParams();
      }

      this.app.lastOutputClicked.compo.quickSave();
      this.app.lastOutputClicked = null;
    }
  }
  resetAudioParams() {
    //FORCES THE CUSTOM AUDIO PARAMS WORKLET TO TRIGGER THE VALUE AGAIN
    this.customAudioParamsWorkletNode.port.postMessage({ reset: true });
  }
  createInfoButton() {
    if (!this.infoText) return;
    this.infoButton = document.createElement("button");
    this.infoButton.classList.add("infoButton");
    this.infoButton.innerText = "?";
    this.infoButton.onclick = () => {
      this.app.showMessage(this.infoText);
    };
    this.container.appendChild(this.infoButton);
  }
  createIcon() {
    this.icon = document.createElement("icon");
    this.container.appendChild(this.icon);
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
      })
    );
  }

  remove() {
    if (this.unsubscribeToFireStore instanceof Function)
      this.unsubscribeToFireStore();
    this.app.removeAllConnections(this);
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
    try {
      compo.inputElements[input].button.classList.add("connected");
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
            where.whichInput
          )
        : this.node.connect(where.whereToConnect, numberOfOutput);
    } catch (e) {
      console.warn(e);
    }

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
    this.container.setPointerCapture(e.pointerId);
  }

  onPointerMove(e) {
    if (!this._dragging) return;
    let s = this.app.scale || 1;
    let rack = this.app.container.getBoundingClientRect();
    this.container.style.left =
      (e.clientX - rack.left) / s - this._grabX + "px";
    this.container.style.top =
      (e.clientY - rack.top) / s - this._grabY + "px";
    this.container.style.setProperty("--posX", this.container.style.left);
    this.container.style.setProperty("--posY", this.container.style.top);
    this.app.updateAllLines();
  }

  onPointerUp(e) {
    if (!this._dragging) return;
    this._dragging = false;
    this.quickSave();
    this.app.updateAllLines();
  }

  createContainer() {
    this.container = document.createElement("component");
    this.container.component = this;
    this.container.draggable = false;
    this.container.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.container.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.container.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.container.addEventListener("pointercancel", (e) => this.onPointerUp(e));

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

    this.inputsDiv = document.createElement("div");
    this.inputsDiv.classList.add("inputsDiv");
    this.container.appendChild(this.inputsDiv);

    if (this.createdBy == this.app.userID) {
      this.container.classList.add("mine");
    }
  }
  isThisComponentMine() {
    return this.createdBy == this.app.userID;
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

    window.tc = this;
    // console.log(this);
  }
  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
  }

  updateBPM() {}

  createOutputButton() {
    if (
      this.type.toLowerCase() == "output" ||
      this.type.toLowerCase() == "imagemaker" ||
      this.type.toLowerCase() == "numberdisplaycomponent" ||
      this.type.toLowerCase() == "visualizer" ||
      this.type.toLowerCase() == "frequencyanalizer"
    ) {
      return;
    }
    this.outputs = document.createElement("outputs");
    this.container.appendChild(this.outputs);

    for (let i = 0; i < (this.node || {}).numberOfOutputs; i++) {
      let outputButton = document.createElement("input");
      outputButton.type = "checkbox";
      outputButton.classList.add("outputButton");
      outputButton.setAttribute("numberOfOutput", i);
      outputButton.onclick = (e) => {
        this.onOutputClicked(e, outputButton);
      };
      this.outputs.appendChild(outputButton);
    }
  }
  onOutputClicked(e, outputButton) {
    e.preventDefault();
    e.stopPropagation();
    this.app.lastOutputClicked = { compo: this, output: outputButton };
  }
  updateFromSerialized(other) {
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
      constructor: this.constructor.name,
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
