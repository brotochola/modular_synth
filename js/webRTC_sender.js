class WebRTCSender extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.peer = new Peer(makeid(6));
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
      let p = document.createElement("p");
      p.innerHTML = "connected to " + this.whoAmICalling;
      this.container.appendChild(p);
    }
  }
  remove() {
    if (this.call) this.call.close();
    this.peer.destroy();

    super.remove();
  }
}
