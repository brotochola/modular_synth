class WebRTCReceiver extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.ready = true;

    this.p = document.createElement("p");
    this.container.appendChild(this.p);

    this.p.innerText = "Loading...";
    this.peer = new Peer(makeid(6));
    this.peer.on("open", (id) => {
      console.log("my peerjs id is", id);
      this.peerID = id;
      this.p.innerHTML =
        "Your ID is <input readonly='readonly' type='text' value='" +
        id +
        "'><br>Someone gotta call you and the output will work";
    });

    this.peer.on("call", (call) => {
      console.log("#incoming call", call);
      this.call = call;
      call.answer();
      call.on("stream", (remoteStream) => {
        console.log("#on stream", remoteStream);
        this.remoteStream = remoteStream;
        this.node = this.app.actx.createMediaStreamSource(this.remoteStream);
        this.audioElement = new Audio();
        this.audioElement.srcObject = this.remoteStream;
        this.p.innerHTML = "ID: " + this.peerID + ".<br>Connected!";

        super.createView();
      });
    });
  }
  createView() {
    this.ready = true;
    if (this.app.patchName) {
      listenToChangesInComponent(this.app.patchName, this.id, (data) => {
        this.updateFromSerialized(data);
      });
    }
  }

  remove() {
    if (this.call) this.call.close();
    this.peer.destroy();

    super.remove();
  }
}
