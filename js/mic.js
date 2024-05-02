class Mic extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    navigator.getUserMedia(
      { video: false, audio: true },
      (stream) => this.createNode(stream),
      console.warn
    );

    // this.createInputButtons();
  }

  createNode(stream) {
    this.node = this.app.actx.createMediaStreamSource(stream);

    // mic.connect(spe);
    // spe.connect(ctx.destination);
    // draw();
  }
}
