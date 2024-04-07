class Connection {
  constructor(from, to, audioParam) {
    this.from = from;
    this.to = to;
    this.audioParam = audioParam;
    this.line = null;
    this.id = makeid(8);
  }
  remove() {
    let whereToConnect = this.audioParam.startsWith("in")
      ? this.to.node
      : this.to.node[this.audioParam];
    try {
      this.from.node.disconnect(whereToConnect);
    } catch (e) {
      console.log(e);
    }
    this.to.inputElements[this.audioParam].button.classList.remove("connected");
    this.line.parentNode.removeChild(this.line);
    this.line = null;
    this.from.connections = this.from.connections.filter(
      (k) => k.id != this.id
    );
  }

  reset() {
    console.log(
      "resetting ",
      this.from.type,
      this.from.id,
      " -> ",
      this.to.type,
      this.to.id,
      "(",
      this.audioParam,
      ")"
    );
    let whereToConnect = this.audioParam.startsWith("in")
      ? this.to.node
      : this.to.node[this.audioParam];

    if (this.to.type == "output") {
      whereToConnect = this.to.app.actx.destination;
    }

    try {
      this.from.node.disconnect(whereToConnect);
    } catch (e) {
      console.log(e);
    }
    try {
      this.from.node.connect(whereToConnect);
    } catch (e) {
      console.log(e);
    }
  }

  serialize() {
    return {
      from: this.from.id,
      to: this.to.id,
      audioParam: this.audioParam,
      id: this.id,
    };
  }
}
