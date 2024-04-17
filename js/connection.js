class Connection {
  constructor(from, to, audioParam, numberOfOutput, app) {
    this.app = app;
    this.from = from;
    this.to = to;
    this.audioParam = audioParam;
    this.numberOfOutput = numberOfOutput;
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
    this.from.connections = this.from.connections.filter(
      (k) => k.id != this.id
    );
  }

  redraw() {
    let color=(this.from.type+this.to.type+this.audioParam+this.numberOfOutput).toRGB()
    this.app.drawLine(
      this.from.outputs.querySelector(
        '.outputButton[numberOfOutput="' + this.numberOfOutput + '"]'
      ),
      this.to.inputElements[this.audioParam].button,color
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
