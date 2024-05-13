class Reverb extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    // load impulse response from file
    fetch("audios/reverb/Basement.m4a").then(async (response) => {
      this.arraybuffer = await response.arrayBuffer();
      this.node = this.app.actx.createConvolver();
      this.node.buffer = await this.app.actx.decodeAudioData(this.arraybuffer);
    });
  }
}
