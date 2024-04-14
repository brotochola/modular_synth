class Connection {
  constructor(from, to, audioParam, numberOfOutput) {
    this.from = from;
    this.to = to;
    this.audioParam = audioParam;
    this.numberOfOutput = numberOfOutput;
    this.line = null;
    this.id = makeid(8);
  }
  remove() {
    let where = figureOutWhereToConnect(
      this.from,
      this.to,
      this.audioParam,
      this
    );

    try {
      where.whichInput
        ? this.from.node.disconnect(
            where.whereToConnect,
            this.numberOfOutput,
            where.whichInput
          )
        : this.from.node.disconnect(where.whereToConnect, this.numberOfOutput);
    } catch (e) {
      // debugger;
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
    // console.log(
    //   "resetting ",
    //   this.from.type,
    //   this.from.id,
    //   " -> ",
    //   this.to.type,
    //   this.to.id,
    //   "(",
    //   this.audioParam,
    //   ")"
    // );
    let where = figureOutWhereToConnect(
      this.from,
      this.to,
      this.audioParam,
      this
    );

    try {
      where.whichInput
        ? this.from.node.disconnect(
            where.whereToConnect,
            this.numberOfOutput,
            where.whichInput
          )
        : this.from.node.disconnect(where.whereToConnect, this.numberOfOutput);
    } catch (e) {
      // debugger;
      // console.warn(e);
    }

    try {
      where.whichInput
        ? this.from.node.connect(
            where.whereToConnect,
            this.numberOfOutput,
            where.whichInput
          )
        : this.from.node.connect(where.whereToConnect, this.numberOfOutput);
    } catch (e) {
      // debugger;
      // console.warn(e);
    }
  }

  serialize() {
    return {
      from: this.from.id,
      to: this.to.id,
      audioParam: this.audioParam,
      numberOfOutput: this.numberOfOutput,
      id: this.id,
    };
  }
}
