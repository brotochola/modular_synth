class Component {
  constructor(app, serializedData) {
    this.app = app;
    this.type = this.constructor.name;
    this.serializedData = serializedData;
    this.audioParams = [];
    this.retryCounter = 0;
    this.dragStartedAt = [0, 0];
    this.connections = [];
    this.running = false;
    this.id = serializedData?.id
      ? serializedData.id
      : this.type.toLowerCase().substring(0, 6) + "_" + makeid(8);
    if (this.type.toLowerCase() == "output") this.id = "output";

    this.createContainer();
    this.createIcon();
    this.createView();
    this.inputElements = {};
    this.outputElements = {};
    this.app.actx.resume();
    this.active = false;

    if (!serializedData) this.quickSave();
  }

  quickSave() {
    // console.trace("saving ", this.type, this.id);
    if (!this.app.patchName) return;
    if (this.id == "output") return;
    createInstanceOfComponentInFirestore(this.app.patchName, this.serialize());
    setTimeout(() => {
      try {
        this.app.saveListOfComponentsInFirestore();
      } catch (e) {
        console.warn(e);
      }
    }, 1000);
  }
  loadFromSerializedData() {
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
        this.serializedData.connections,
        doWeHaveToUpdateLines
      );
    });

    //THIS IS IMPLEMENTED IN EACH CLASS THAT INHERITES FROM THIS ONE
    if (this.updateUI instanceof Function) this.updateUI();
  }

  updateConnectionsFromSerializedData(connections, forceUpdateLines) {
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
          setTimeout(() => this.app.addSerializedConnection(incomingConn), 50);
          doWeHaveToUpdateLines = true;
        }
      }
    }

    //CHECK IF WE GOTTA REMOVE SOME
    for (let currentConn of this.connections) {
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
    this.createOutputButton();
    this.createInputButtons();
    this.createWorkletForCustomTriggers();
    this.createWorkletForCustomParams();
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();

    setTimeout(() => {
      if (!this.app) console.trace("no app??");
      if (this.app.patchName) this.startListeningToChangesInThiscomponent();
    }, 2000);
  }

  startListeningToChangesInThiscomponent() {
    if (!this.app.patchName) return;
    this.unsubscribeToFireStore = listenToChangesInComponent(
      this.app.patchName,
      this.id,
      (data) => {
        // console.log("#changes", this.type, this.id, data);
        this.updateFromSerialized(data);
      }
    );
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
    if (this.type == "Mouse") return;
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
    console.log("audio param clicked", audioParam);

    if (this.inputElements[audioParam].button.classList.contains("connected")) {
      let componentFromWhichThisConnectionComes = Connection.getComponentFrom(
        this,
        audioParam
      );

      this.disconnect(audioParam);

      setTimeout(() => componentFromWhichThisConnectionComes.quickSave(), 10);
    } else {
      if (!this.app.lastOutputClicked) return;

      let numberOfOutput =
        this.app.lastOutputClicked.output.getAttribute("numberOfOutput");

      this.app.lastOutputClicked.compo.connect(
        this,
        audioParam,
        numberOfOutput
      );

      this.app.lastOutputClicked.compo.quickSave();
      this.app.lastOutputClicked = null;
    }
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

  remove() {
    if (this.unsubscribeToFireStore instanceof Function)
      this.unsubscribeToFireStore();
    this.app.removeAllConnections(this);
    this.container.parentElement.removeChild(this.container);

    this.app.components = this.app.components.filter((c) => c != this);
    if (this.app.patchName)
      removeComponentFromFirestore(this.app.patchName, this.id);
    this.app.saveListOfComponentsInFirestore();
    setTimeout(() => this.clearAll(), 50);
  }
  connect(compo, input, numberOfOutput) {
    console.log("#connect", compo, input);

    //CREATE CONNECTION INSTANCE
    let conn = new Connection(this, compo, input, numberOfOutput, this.app);
    //ADD CLASS TO HTML ELEMENT
    try {
      compo.inputElements[input].button.classList.add("connected");
    } catch (e) {
      console.trace(e);
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
      -box.x + e.clientX - this.dragStartedAt[0] + "px";
    this.container.style.top =
      -box.y + e.clientY - this.dragStartedAt[1] + "px";
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

    this.container.style.setProperty(
      "--posX",
      (Math.random() * 100).toFixed(2) + "%"
    );
    this.container.style.setProperty(
      "--posY",
      (Math.random() * 100).toFixed(2) + "%"
    );
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
  updateBPM() {}

  createOutputButton() {
    if (
      this.type.toLowerCase() == "output" ||
      this.type.toLowerCase() == "imagemaker" ||
      this.type.toLowerCase() == "numberdisplaycomponent" ||
      this.type.toLowerCase() == "visualizer"
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

    obj.connections = this.connections.map((k) => k.serialize());

    return sortObjectKeysAlphabetically(obj);
  }
}
