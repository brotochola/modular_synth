class Connection {
  constructor(from, to, audioParam) {
    this.from = from;
    this.to = to;
    this.audioParam = audioParam;
    this.line = null;
    this.id = makeid(8);
  }
  remove() {
    this.from.node.disconnect();
    this.to.inputElements[this.audioParam].button.classList.remove("connected")
    this.line.parentNode.removeChild(this.line);
    this.line = null;
    this.from.connections = this.from.connections.filter(
      (k) => k.id != this.id
    );
  }
}
