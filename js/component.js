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
    this.dragStartedAt = [0, 0];
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
    console.log("#load from serialized data", this, this.serializedData);
    if (!this.serializedData) return;

    if (this.node) {
      let keys = Object.keys(this.serializedData.audioParams);
      for (let key of keys) {
        this.node[key].value = this.serializedData.audioParams[key];
        this.inputElements[key].textInput.value =
          this.serializedData.audioParams[key];
      }

      if (this.serializedData.node?.type) {
        this.node.type = this.serializedData.node.type;
      }
    }
    //LOAD THOSE PARAMETERS THAT WANTED TO BE SAVED FOR EACH TYPE OF COMPONENT
    if (this.serializedData.valuesToSave) {
      for (let key of this.serializedData.valuesToSave) {
        this[key] = this.serializedData[key];
      }
    }

    //POSITION:
    let doWeHaveToUpdateLines = false;
    if (
      this.container.style.left != this.serializedData.x ||
      this.container.style.top != this.serializedData.y
    ) {
      doWeHaveToUpdateLines = true;
    }
    this.container.style.left = this.serializedData.x;
    this.container.style.top = this.serializedData.y;

    this.app.waitUntilAllComopnentsAreReady(() => {
      this.updateConnectionsFromSerializedData(
        (this.serializedData || {}).connections || [],
        doWeHaveToUpdateLines
      );
      if (cb instanceof Function) cb();
    });

    //THIS IS IMPLEMENTED IN EACH CLASS THAT INHERITES FROM THIS ONE
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
          //ADD IT

          // debugger
          setTimeout(() => this.app.addSerializedConnection(incomingConn), 50);
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
      if (!this.app) {
        console.log("no app??");
      } else if (this.app.patchName) {
        this.startListeningToChangesInThiscomponent();
      }
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

    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/customAudioParamsWorklet.js")
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

    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/triggerWorklet.js")
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
    if (this.type == "Mouse" || this.type == "WebRTCReceiver") return;
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
        textInput.max = 2000;
        textInput.min = 0;
        textInput.value = !this.node.parameters
          ? this.node[inp].value.toString()
          : this.node.parameters.get(inp).value.toString();
        textInput.step = 1;
      }

      this.inputElements[inp] = { button, textInput };

      audioParamRow.appendChild(button);
      if (textInput) audioParamRow.appendChild(textInput);
      this.inputsDiv.appendChild(audioParamRow);
    }
  }

  onParamChanged(event, param) {
    event.stopPropagation();
    if (this.node?.parameters?.get(param)) {
      this.node.parameters.get(param).value = event.target.value;
    } else {
      this.node[param].value = event.target.value;
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
    this.icon.onclick = () => {
      this.toggleActive();
    };
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
    if (this.app.patchName) {
      removeComponentFromFirestore(this.app.patchName, this.id);
    }

    setTimeout(() => {
      this.app.updateAllLines()
      this.clearAll()
      
    }, 50);
  }
  connect(compo, input, numberOfOutput) {
    // console.log("#connect", compo, input);

    //CREATE CONNECTION INSTANCE
    let conn = new Connection(this, compo, input, numberOfOutput, this.app);
    //ADD CLASS TO HTML ELEMENT
    try {
      compo.inputElements[input].button.classList.add("connected");
    } catch (e) {
      console.log(e);
      // debugger;
    }
    //ADD THE CONNECTION INSTANCE TO THE ARRAY OF CONNECTIONS OF THIS COMPONENT
    this.connections.push(conn);

    let where = figureOutWhereToConnect(this, compo, input, conn);
    // debugger
    where.whichInput
      ? this.node.connect(
          where.whereToConnect,
          numberOfOutput,
          where.whichInput
        )
      : this.node.connect(where.whereToConnect, numberOfOutput);

    conn.redraw();
  }

  ondragend(e) {
    e.stopPropagation();
    e.preventDefault();
    let box = this.app.container.getBoundingClientRect();
    this.container.style.left =
      -box.x +
      e.clientX / this.app.scale -
      this.dragStartedAt[0] / this.app.scale +
      "px";
    this.container.style.top =
      -box.y +
      e.clientY / this.app.scale -
      this.dragStartedAt[1] / this.app.scale +
      "px";

    this.container.style.setProperty("--posX", this.container.style.left);
    this.container.style.setProperty("--posY", this.container.style.top);

    this.quickSave();
    this.app.updateAllLines();
  }
  ondragstart(e) {
    this.dragStartedAt[0] = e.layerX;
    this.dragStartedAt[1] = e.layerY;
  }

  createContainer() {
    this.container = document.createElement("component");
    this.container.component = this;
    this.container.draggable = true;
    this.container.ondragend = (e) => this.ondragend(e);
    this.container.ondragstart = (e) => this.ondragstart(e);

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

    this.container.onmousedown = () => {
      this.toggleActive();
    };

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
      if (this.node && this.node[audioParam]) {
        obj.audioParams[audioParam] = this.node[audioParam].value;
      }
      obj.audioParams = sortObjectKeysAlphabetically(obj.audioParams);
    }
    //these parameters are set on each class:
    if (Array.isArray(this.valuesToSave)) {
      for (let key of this.valuesToSave) {
        if (this[key]) obj[key] = this[key];
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

  waitUntilImReady(cb, counter) {
    if (!counter) counter = 1;
    else counter++;

    if (!this.ready)
      setTimeout(() => {
        this.waitUntilImReady(cb, counter);
      }, 25);
    else cb();
  }
}
