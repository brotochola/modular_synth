class WebRTCSender extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.peer = new Peer(
      this.app.patchName ? this.app.patchName + "_" : "" + makeid(6)
    );
    this.node = this.app.actx.createMediaStreamDestination();
    // this.app.streamToSendViaRTC=this.node.stream
    // this.node.stream
    this.counter = 0;
    this.button = document.createElement("button");
    this.button.innerHTML = "connect";
    this.input = document.createElement("input");
    this.input.placeholder = "peer's id";
    this.container.appendChild(this.button);
    this.container.appendChild(this.input);

    this.button.onclick = () => this.handleButtonClick();
  }
  handleButtonClick() {
    // let anotherPeersID = prompt("peerID");
    if (!this.input.value) return console.warn("no peer id");
    this.whoAmICalling = this.input.value;
    this.call = this.peer.call(this.whoAmICalling, this.node.stream);

    this.input.value = "";
    this.input.placeholder = "calling..." + this.whoAmICalling;
    this.input.disabled = true;
    this.button.style.display = "none";
    this.checkIfPeerIsConnected();
  }

  checkIfPeerIsConnected() {
    let state = ((this.call || {}).dataChannel || {}).readyState;
    if (state != "open") {
      this.counter++;
      if (this.counter > 10) {
        this.input.placeholder = "FAILED";
        return console.warn("waited too long...");
      }
      console.log("retrying too connect", this.counter);
      setTimeout(() => this.checkIfPeerIsConnected(), 500);
    } else {
      this.input.style.display = "none";
      this.container.innerHTML += "connected to " + this.whoAmICalling;
    }
  }
  remove() {
    this.peer.destroy();
    this.call.close();
    super.remove();
  }
}
