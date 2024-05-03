class Connection {
  constructor(from, to, audioParam, numberOfOutput, app) {
    Connection.app = app;
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
    let color = (
      this.from.type +
      this.to.type +
      this.audioParam +
      this.numberOfOutput
    ).toRGB();

    let fromEl = this.from.outputs.querySelector(
      '.outputButton[numberOfOutput="' + this.numberOfOutput + '"]'
    );
    let toEl = (this.to.inputElements[this.audioParam]||{}).button;
    if(!toEl) {
      console.log("epa")
    }
    this.app.drawLine(fromEl, toEl, color);
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

  static compareTwoConnections(c1, c2) {
    let sc1, sc2;
    if (c1 instanceof Connection) {
      sc1 = c1.serialize();
    } else {
      sc1 = c1;
    }

    if (c2 instanceof Connection) {
      sc2 = c2.serialize();
    } else {
      sc1 = c2;
    }

    return (
      sc1.from == sc2.from &&
      sc1.to == sc2.to &&
      sc1.numberOfOutput == sc2.numberOfOutput &&
      sc1.audioParam == sc2.audioParam
    );
  }

  static getComponentFrom(to, audioParam) {
    let conn = Connection.app
      .getAllConnections()
      .filter(
        (connection) =>
          connection.to.id == to.id && connection.audioParam == audioParam
      );
    if (conn.length) {
      return conn[0].from;
    }
    return null;
  }
}
