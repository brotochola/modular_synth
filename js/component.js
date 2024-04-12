class Component {
  constructor(app, serializedData) {
    this.app = app;
    this.type = this.constructor.name;
    this.serializedData = serializedData;

    this.dragStartedAt = [0, 0];
    this.connections = [];
    this.running = false;
    this.id = serializedData?.id ? serializedData.id : makeid(8);

    this.createContainer();
    this.createIcon();
    this.createView();
    this.inputElements = {};
    this.outputElements = {};
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

    this.container.style.left = this.serializedData.x;
    this.container.style.top = this.serializedData.y;
  }

  createView() {
    if (!this.node) {
      setTimeout(() => this.createView(), 20);
      return;
    }

    // setTimeout(() => {
    this.createOutputButton();
    this.createInputButtons();
    makeChildrenStopPropagation(this.container);
    this.loadFromSerializedData();
    // }, 100);
  }

  createInputButtons() {

    if(this.type=="Mouse") return

    this.audioParams = Object.keys(Object.getPrototypeOf(this.node)).filter(
      (k) => this.node[k] instanceof AudioParam
    );

    for (let i = 0; i < this.node.numberOfInputs; i++) {
      this.audioParams.push("in_" + i);
    }

    for (let inp of this.audioParams) {
      if ((inp == "gain" || inp == "detune") && this.type != "Amp") {
        continue;
      }
      let audioParamRow = document.createElement("audioParamRow");
      let button = document.createElement("button");
      button.onclick = (e) => this.onAudioParamClicked(inp);
      button.classList.add("input");
      button.classList.add(inp);
      button.innerText = inp;

      let textInput;
      if (!inp.startsWith("in")) {
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
    this.container.style.left = e.clientX - this.dragStartedAt[0] + "px";
    this.container.style.top = e.clientY - this.dragStartedAt[1] + "px";

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
        Math.floor((window.innerWidth - 200) * Math.random()) + "px";
      this.container.style.top =
        Math.floor((window.innerHeight - 250) * Math.random() - 100) + "px";
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
  }

  createOutputButton() {
    if (
      this.type.toLowerCase() == "output" ||
      this.type.toLowerCase() == "imagemaker"
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
    obj.x = this.container.style.left;
    obj.y = this.container.style.top;

    return obj;
  }
}
