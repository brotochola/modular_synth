class Component {
  constructor(app, serializedData) {
    this.app = app;
    this.type = this.constructor.name;
    this.serializedData = serializedData;
    this.audioParams = [];

    this.dragStartedAt = [0, 0];
    this.connections = [];
    this.running = false;
    this.id = serializedData?.id ? serializedData.id : makeid(8);

    this.createContainer();
    this.createIcon();
    this.createView();
    this.inputElements = {};
    this.outputElements = {};
    this.app.actx.resume();
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
      for (let value of this.serializedData.valuesToSave) {
        this[value] = this.serializedData[value];
      }
    }
    if (this.updateUI instanceof Function) this.updateUI();
    this.container.style.left = this.serializedData.x;
    this.container.style.top = this.serializedData.y;
  }

  createView() {
    //THIS WILL WAIT UNTIL THE NODE EXISTS
    if (!this.node) {
      setTimeout(() => this.createView(), 20);
      return console.warn(this.id, this.type, "NODE NOT READY");
    }
    this.node.parent = this;
    this.createOutputButton();
    this.createInputButtons();
    this.createWorkletForCustomInputs();
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();
  }

  createWorkletForCustomInputs() {
    if (!Array.isArray(this.customAudioParams)) return;

    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/triggerWorklet.js")
      .then(() => {
        this.customAudioParamsWorkletNode = new AudioWorkletNode(
          this.app.actx,
          "trigger-worklet",
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
          if (this.handleTriggerFromWorklet instanceof Function)
            this.handleTriggerFromWorklet(e.data);
        };
      });
  }

  createInputButtons() {
    if (this.type == "Mouse") return;
    console.log("CREATING BUTTONS FOR", this.type, this.id);

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

    for (let inp of [...this.audioParams, ...(this.customAudioParams || [])]) {
      // if ((inp == "gain" || inp == "detune") && this.type != "Amp")   continue;

      //CREATE THE ROW
      let audioParamRow = document.createElement("audioParamRow");
      //CREATE THE BUTTON
      let button = document.createElement("button");
      button.onclick = (e) => this.onAudioParamClicked(inp);
      button.classList.add("input");
      button.classList.add(inp);
      button.innerText = inp;

      let textInput;
      //AUDIO INPUTS DON'T HAVE A TEXT TO SET THEM, DAAH
      if (
        !inp.startsWith("in") &&
        !(this.customAudioParams || []).includes(inp)
      ) {
        textInput = document.createElement("input");
        textInput.classList.add(inp);
        textInput.type = "number";
        textInput.onchange = (e) => this.onParamChanged(e, inp);
        textInput.max = 2000;
        textInput.min = 0;
        textInput.value = this.node[inp].value.toString();
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

    this.node[param].setValueAtTime(event.target.value, 0);
  }
  onAudioParamClicked(audioParam) {
    console.log("audio param clicked", audioParam);
    //  debugger

    if (this.inputElements[audioParam].button.classList.contains("connected")) {
      this.disconnect(audioParam);
    } else {
      if (!this.app.lastOutputClicked) return;

      let numberOfOutput =
        this.app.lastOutputClicked.output.getAttribute("numberOfOutput");

      this.app.lastOutputClicked.compo.connect(
        this,
        audioParam,
        numberOfOutput
      );
      this.app.lastOutputClicked = null;
    }
  }

  createIcon() {
    this.icon = document.createElement("icon");
    this.container.appendChild(this.icon);
  }
  disconnect(audioParam) {
    // for (let c of this.connections) {
    //   c.line.parentNode.removeChild(c.line);
    //   c = null;
    // }
    // this.connections = [];
    this.app.removeConnectionToMe(this, audioParam);
    this.app.updateAllLines();
  }

  remove() {
    this.app.removeAllConnections(this);
    this.container.parentElement.removeChild(this.container);
    this.app.components = this.app.components.filter((c) => c != this);
  }
  connect(compo, input, numberOfOutput) {
    // console.log("#connect", compo, input);

    //CREATE CONNECTION INSTANCE
    let conn = new Connection(this, compo, input, numberOfOutput);
    //ADD CLASS TO HTML ELEMENT
    compo.inputElements[input].button.classList.add("connected");
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

    this.drawLine(conn);
  }

  ondragend(e) {
    e.stopPropagation();
    e.preventDefault();
    let box = this.app.container.getBoundingClientRect();
    this.container.style.left =
      -box.x + e.clientX - this.dragStartedAt[0] + "px";
    this.container.style.top =
      -box.y + e.clientY - this.dragStartedAt[1] + "px";

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

    if (this.type.toLowerCase() == "output") {
      this.container.style.left = Math.floor(window.innerWidth * 0.5) + "px";
      this.container.style.top = Math.floor(window.innerHeight * 0.5) + "px";
    } else {
      this.container.style.left =
        Math.floor((window.innerWidth - 400) * Math.random() + 200) + "px";
      this.container.style.top =
        Math.floor((window.innerHeight - 500) * Math.random() + 250) + "px";
    }

    this.app.container.appendChild(this.container);

    this.container.classList.add(this.type);

    this.inputsDiv = document.createElement("div");
    this.inputsDiv.classList.add("inputsDiv");
    this.container.appendChild(this.inputsDiv);

    this.container.onmousedown = () => {
      window.tc = this;
      console.log(this);
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

    for (let i = 0; i < ((this.node || {}).numberOfOutputs || 1); i++) {
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
  drawLine(conn) {
    let line = createLine(
      conn.from.outputs.querySelector(
        '.outputButton[numberOfOutput="' + conn.numberOfOutput + '"]'
      ),
      conn.to.inputElements[conn.audioParam].button
    );
    // debugger
    conn.line = line;
    this.app.container.appendChild(line);
  }
  updateMyLines() {
    for (let conn of this.connections) {
      conn.line?.parentNode?.removeChild(conn.line);
      this.drawLine(conn);
    }
  }

  serialize() {
    let obj = {
      id: this.id,
      audioParams: {},
      type: this.type,
      constructor: this.constructor.name,
      node: {},
    };
    if (this.formula) {
      obj.formula = this.formula;
    }
    if ((this.node || {}).type) {
      obj.node.type = this.node.type;
    }
    for (let audioParam of this.audioParams || []) {
      if (this.node && this.node[audioParam]) {
        obj.audioParams[audioParam] = this.node[audioParam].value;
      }
    }
    //these parameters are set on each class:
    if (this.valuesToSave && Array.isArray(this.valuesToSave)) {
      for (let value of this.valuesToSave) {
        obj[value] = this[value];
      }
      obj.valuesToSave = this.valuesToSave;
    }
    obj.x = this.container.style.left;
    obj.y = this.container.style.top;

    return obj;
  }
}
