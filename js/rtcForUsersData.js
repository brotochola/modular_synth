class RTCForUsersData {
  constructor(app) {
    this.app = app;

    this.peerID = this.app.userID;
    this.peer = new Peer(this.peerID, {});

    this.counter = 0;
    this.peer.on("open", (id) => {
      console.log("connection open", id);
      this.state = "ready";
    });

    this.connections = [];

    this.state = "loading";

    this.peer.on("connection", (conn) => {
      console.log("#incoming connection", conn);
      conn.on("data", (data) => {
        this.handleIncomingMessage(data);
      });

      this.connections.push({ conn, state: "connected", counter: 0 });

      // this.checkIfPeerIsConnected();
    });
  }

  handleIncomingMessage(data) {
    let msg = JSON.parse(data);
    console.log("#incoming msg", msg);

    if (!this.app.admin) {
      if (msg.action == "play") {
        this.app.actx.resume();
      } else if (msg.action == "stop") {
        this.app.actx.suspend();
      }
    }
  }
  sendMessage(msg) {
    this.connections.map((k) => {
      k.conn.send(JSON.stringify(msg));
    });
  }

  connect(id) {
    console.log("#connecting to ", id);
    if (this.connections.filter((k) => k.to == id).length) {
      return console.warn("you already had a connection to this id");
    }

    if (this.state != "ready") {
      return console.warn("not ready to connect", this.state);
    }

    this.whoAmICalling = id;
    this.connections.push({
      to: id,
      conn: this.peer.connect(id),
      state: "connecting",
      counter: 0,
    });

    this.checkIfPeerIsConnected();
  }

  checkIfPeerIsConnected() {
    let notConnectedOnes = [];
    for (let i = 0; i < this.connections.length; i++) {
      let state = (((this.connections[i] || {}).conn || {}).dataChannel || {})
        .readyState;
      // console.log("#", i, state);
      if (state == "open") {
        this.handlePeerIsConnected(i);
      } else {
        notConnectedOnes.push(this.connections[i]);
      }
    }

    // console.log("#checking connections", notConnectedOnes);

    if (notConnectedOnes.length) {
      for (let c of notConnectedOnes) {
        c.counter++;
        if (c.counter > 10) {
          c.state = "failed";
          this.connections = this.connections.filter((k) => k.to != c.to);
        }
      }
      setTimeout(() => this.checkIfPeerIsConnected(), 500);
    }
  }

  handlePeerIsConnected(i) {
    console.log("#you 're connected on WEBRTC")
    this.state = "connected";
    let conn = this.connections[i].conn;
    conn.state = "connected";

    // console.log("#connected", conn);

    conn.on("data", (data) => {
      this.handleIncomingMessage(data);
    });

    conn.on("close", () => {
      this.handleConnectionClosed(conn);
    });

    // this.addListenerForMessages();
  }

  handleConnectionClosed(conn) {
    console.log("#got disconnected");
    this.connections = this.connections.filter((k) => k.conn != conn);
    this.state = "ready";
  }

  remove() {
    this.state = "detroyed";

    if (this.call) this.call.close();
    this.peer.destroy();
  }
}
