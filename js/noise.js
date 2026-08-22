class Noise extends Component {
  static name = "Noise";
  constructor(app,serializedData) {
    super(app,serializedData);
    this.infoText =
      "White noise from a looping random buffer. Continuous hiss / random CV source. Prefer the worklet Noise module if both are in the menu — same idea, different engine.";

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
