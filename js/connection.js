class Connection {
  constructor(from, to, audioParam, numberOfOutput, app) {
    Connection.app = app;
    this.app = app;
    this.from = from;
    this.to = to;
    this.audioParam = audioParam;
    this.numberOfOutput = numberOfOutput;
    this.id = makeid(8);
    if (app) {
      app.markCablesDirty();
      if (app.invalidateConnections) app.invalidateConnections();
    }
  }
  remove() {
    let jackName =
      (this.to.resolveJackName && this.to.resolveJackName(this.audioParam)) ||
      this.audioParam;
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
      // Already disconnected (e.g. full node.disconnect earlier) — ignore.
    }

    let actCh =
      this.to.jackActivityChannel && this.to.jackActivityChannel(jackName);
    if (this.to.jackActivityNode && actCh >= 0) {
      try {
        this.from.node.disconnect(
          this.to.jackActivityNode,
          this.numberOfOutput,
          actCh,
        );
      } catch (e) {}
    }

    let inpEl = this.to.inputElements[jackName] || this.to.inputElements[this.audioParam];
    if (inpEl && inpEl.button) inpEl.button.classList.remove("connected");
    if (inpEl && inpEl.led) setLedBipolar(inpEl.led, 0);

    this.from.connections = this.from.connections.filter(
      (k) => k.id != this.id
    );

    // Clear source output LED if no remaining cables from that out
    if (this.from.clearOutputLedIfIdle) {
      this.from.clearOutputLedIfIdle(this.numberOfOutput);
    } else if (this.from.syncOutputConnected) {
      this.from.syncOutputConnected(this.numberOfOutput);
    }

    if (this.app) {
      if (this.app.cableWorld) this.app.cableWorld.freeByConnectionId(this.id);
      this.app.markCablesDirty();
      if (this.app.invalidateConnections) this.app.invalidateConnections();
    }
  }

  redraw() {
    if (this.app) this.app.markCablesDirty();
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

    let actCh =
      this.to.jackActivityChannel &&
      this.to.jackActivityChannel(
        (this.to.resolveJackName && this.to.resolveJackName(this.audioParam)) ||
          this.audioParam,
      );
    if (this.to.jackActivityNode && actCh >= 0) {
      try {
        this.from.node.disconnect(
          this.to.jackActivityNode,
          this.numberOfOutput,
          actCh,
        );
      } catch (e) {}
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

    if (this.to.jackActivityNode && actCh >= 0) {
      try {
        this.from.node.connect(
          this.to.jackActivityNode,
          this.numberOfOutput,
          actCh,
        );
      } catch (e) {}
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
      sc2 = c2;
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
