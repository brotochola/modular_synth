class WebRTCSender extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.peerID = this.id + "_" + this.app.userID;
    this.peer = new Peer(this.peerID, {});

    this.node = this.app.actx.createMediaStreamDestination();

    this.counter = 0;
    this.button = document.createElement("button");
    this.p = document.createElement("p");
    this.container.appendChild(this.p);
    this.p.style.display = "none";
    this.button.innerHTML = "connect";
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "peer's id";
    this.container.appendChild(this.button);
    this.container.appendChild(this.input);
    this.connected = false;
    this.button.onclick = () => this.handleButtonClick();
    this.sessionID = this.app.sessionID;
    
  }
  handleButtonClick() {
    if (!this.input.value) return console.warn("no peer id");
    this.whoAmICalling = this.input.value;
    this.call = this.peer.call(this.whoAmICalling, this.node.stream);

    this.input.value = "";
    this.input.placeholder = "calling..." + this.whoAmICalling;
    this.input.disabled = true;
    this.button.style.display = "none";
    this.checkIfPeerIsConnected();
  }
  handleConnectionClosed() {
    console.log("#sender got disconnected");
    this.connected = false;
    this.input.style.display = "unset";
    this.button.style.display = "unset";
    this.p.style.display = "none";
  }

  checkIfPeerIsConnected() {
    let state = ((this.call || {}).dataChannel || {}).readyState;
    if (state != "open") {
      this.counter++;
      if (this.counter > 10) {
        this.input.placeholder = "FAILED";
        return console.warn("waited too long...");
      }
      console.log(
        "retrying too connect to " + this.whoAmICalling,
        this.counter
      );
      setTimeout(() => this.checkIfPeerIsConnected(), 500);
    } else {
      this.handlePeerIsConnected();
    }
  }
  handlePeerIsConnected() {
    this.button.style.display = "none";
    this.input.style.display = "none";
    this.p.style.display = "unset";
    this.p.innerHTML = "connected to " + this.whoAmICalling;
    this.connected = true;

    this.quickSave();
    if (this.call) {
      this.call.on("close", () => {
        this.handleConnectionClosed();
      });
    }
  }

  remove(forceRemove) {
    if (this.createdBy != this.app.userID && !forceRemove) {
      return console.warn("this component only can be removed by its owner");
    }
    if (this.call) this.call.close();
    this.peer.destroy();

    super.remove();
  }
}
