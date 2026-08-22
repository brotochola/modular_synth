class Reverb extends Component {
  static name = "Reverb";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Convolution reverb. Runs the input through a fixed basement impulse response for space and decay. Plug dry audio in; wet reverb comes out.";

    // load impulse response from file
    fetch("audios/reverb/Basement.m4a").then(async (response) => {
      this.arraybuffer = await response.arrayBuffer();
      this.node = this.app.actx.createConvolver();
      this.node.buffer = await this.app.actx.decodeAudioData(this.arraybuffer);
    });
  }
}
