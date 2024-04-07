class Noise extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    // this.osc = new OscillatorNode(this.app.actx);
    // this.osc.type = "square";
    // this.osc.frequency.value = 0;

    // this.app.actx.audioWorklet.addModule("js/noiseWorklet.js").then(() => {
    //   this.node = new AudioWorkletNode(this.app.actx, "random-worklet", {
    //     numberOfInputs: 0,
    //     numberOfOutputs: 1,
    //   });
    // });
    

    this.bufferSize = 2 * this.app.actx.sampleRate;
    this.noiseBuffer = this.app.actx.createBuffer(
      1,
      this.bufferSize,
      this.app.actx.sampleRate
    );
    this.output = this.noiseBuffer.getChannelData(0);
    for (var i = 0; i < this.bufferSize; i++) {
      this.output[i] = Math.random() * 2 - 1;
    }

    this.node = this.app.actx.createBufferSource();
    this.node.buffer = this.noiseBuffer;
    this.node.loop = true;
    this.node.start(0);

    // this.node = this.app.actx.createScriptProcessor(this.bufferSize, 1, 1);
    // this.node.onaudioprocess = function (e) {
    //   var output = e.outputBuffer.getChannelData(0);
    //   for (var i = 0; i < this.bufferSize; i++) {
    //     output[i] = Math.random() * 2 - 1;
    //   }
    // };
  }
}
