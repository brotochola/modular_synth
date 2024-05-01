class Mic extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    this.node = new GainNode(this.app.actx);

    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;
    navigator.getUserMedia(
      { video: false, audio: true },
      (stream) => this.callback(stream),
      console.warn
    );

    // this.createInputButtons();
  }

  callback(stream) {
    this.node = this.app.actx.createMediaStreamSource(stream);

    // mic.connect(spe);
    // spe.connect(ctx.destination);
    // draw();
  }
}
