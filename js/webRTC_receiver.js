class WebRTCReceiver extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.ready = true;

    this.p = document.createElement("p");
    this.container.appendChild(this.p);

    this.p.innerText = "Loading...";
    this.peerID = this.id + "_" + this.app.userID;
    this.peer = new Peer(this.peerID, {});
    //TEMPORARLY I SET THIS NODE, SO THIS COMPO HAS A NODE WITH NO STREAM
    this.node = this.app.actx.createBufferSource();
    this.audioElement = new Audio();
    this.quickSave(true);

    this.peer.on("open", (id) => {
      this.onConnectionOpen(id);
    });

    this.peer.on("call", (call) => {
      this.call = call;
      call.answer();
      call.on("stream", (remoteStream) => {
        this.remoteStream = remoteStream;
        this.node = this.app.actx.createMediaStreamSource(this.remoteStream);
        this.audioElement.srcObject = this.remoteStream;
        this.handlePeerIsConnected();
        this.quickSave();
        super.createView();
      });

      call.on("close", () => {
        this.handleConnectionClosed();
      });
    });
  }

  handlePeerIsConnected() {
    this.connected = true;
    this.p.innerHTML = "ID: " + this.peerID + ".<br>Connected!";
  }
  onConnectionOpen() {
    this.p.style.display = "block";
    this.p.innerHTML =
      "this component's ID is <input readonly='readonly' type='text' value='" +
      this.peerID +
      "'><br>Someone gotta call you and the output will work";
    this.audioElement.srcObject = null;
    this.remoteStream = null;
    try {
      this.node.stop();
    } catch (e) {}
  }

  handleConnectionClosed() {
    this.connected = false;
    this.onConnectionOpen();
  }
  createView() {
    this.ready = true;
    if (this.app.patchName) {
      listenToChangesInComponent(this.app.patchName, this.id, (data) => {
        this.updateFromSerialized(data);
      });
    }
    super.createView()
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
