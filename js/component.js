class Component {
  constructor(app, type) {
    this.app = app;
    this.type = type;

    this.dragStartedAt = [0, 0];
    this.connections = [];
    this.running = false;
    this.id = makeid(8);

    this.createContainer();
    this.createIcon();
    this.createView();
    this.inputElements = {};
  }

  createInputButtons(doesItHaveAnAudioInput) {
    this.audioParams = Object.keys(Object.getPrototypeOf(this.node)).filter(
      (k) => this.node[k] instanceof AudioParam
    );

    if (doesItHaveAnAudioInput) this.audioParams.push("in");

    for (let inp of this.audioParams) {
      let audioParamRow = document.createElement("audioParamRow");
      let button = document.createElement("button");
      button.onclick = (e) => this.onAudioParamClicked(inp);
      button.classList.add("input");
      button.classList.add(inp);
      button.innerText = inp;

      let textInput;
      if (inp != "in") {
        textInput = document.createElement("input");
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
  connect(compo, input) {
    // debugger
    let conn = new Connection(this, compo, input);
    this.connections.push(conn);
    if (compo.type == "output") {
      this.node.connect(this.app.actx.destination);
    } else {
      let whereToConnect = input == "in" ? conn.to.node : conn.to.node[input];
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

    if (this.type == "output") {
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
    if (this.type == "output") return;
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
      conn.line.parentNode.removeChild(conn.line);
      this.drawLine(conn);
    }
  }
}
