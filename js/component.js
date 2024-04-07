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
  }
  loadFromSerializedData() {
    if (!this.serializedData) return;

    if (this.node) {
      let keys = Object.keys(this.serializedData.audioParams);
      for (let key of keys) {
        this.node[key].value = this.serializedData.audioParams[key];
        this.inputElements[key].textInput.value=this.serializedData.audioParams[key]
      }

      if(this.serializedData.node?.type){
        this.node.type=this.serializedData.node.type
      }

    }

    this.container.style.left=this.serializedData.x
    this.container.style.top=this.serializedData.y
  }

  createView() {
    setTimeout(() => {
      makeChildrenStopPropagation(this.container);
      this.loadFromSerializedData();
    }, 500);
  }

  createInputButtons() {
    this.audioParams = Object.keys(Object.getPrototypeOf(this.node)).filter(
      (k) => this.node[k] instanceof AudioParam
    );

    for (let i = 0; i < this.node.numberOfInputs; i++) {
      this.audioParams.push("in_" + i);
    }

    for (let inp of this.audioParams) {
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
        textInput.value = "200";
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
      this.app.lastOutputClicked.connect(this, audioParam);
    }
    this.app.lastOutputClicked = null;
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

  remove(){
    this.app.removeAllConnections(this);    
    this.container.parentElement.removeChild(this.container);
    this.app.components=this.app.components.filter(c=>c!=this)

  }
  connect(compo, input) {
    // debugger
    let conn = new Connection(this, compo, input);
    this.connections.push(conn);
    if (compo.type.toLowerCase() == "output") {
      this.node.connect(this.app.actx.destination);
    } else {
      let whereToConnect = input.startsWith("in")
        ? conn.to.node
        : conn.to.node[input];
      this.node.connect(whereToConnect);
    }

    compo.inputElements[input].button.classList.add("connected");

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
        Math.floor(window.innerWidth * Math.random()) + "px";
      this.container.style.top =
        Math.floor(window.innerHeight * Math.random()) + "px";
    }

    this.app.container.appendChild(this.container);

    this.container.classList.add(this.type);

    this.inputsDiv = document.createElement("div");
    this.inputsDiv.classList.add("inputsDiv");
    this.container.appendChild(this.inputsDiv);
    this.createOutputButton();

    this.container.onmousedown = () => {
      window.tc = this;
      console.log(this);
    };
  }

  createOutputButton() {
    if (this.type.toLowerCase() == "output") return;
    this.outputButton = document.createElement("input");
    this.outputButton.type = "checkbox";
    this.outputButton.classList.add("outputButton");
    this.outputButton.onclick = (e) => {
      this.onOutputClicked(e);
    };
    this.container.appendChild(this.outputButton);
  }
  onOutputClicked(e) {
    e.preventDefault();
    e.stopPropagation();
    this.app.lastOutputClicked = this;
  }
  drawLine(conn) {
    let line = createLine(
      conn.from.outputButton,
      conn.to.inputElements[conn.audioParam].button
    );
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
    if(this.formula){
      obj.formula = this.formula
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
