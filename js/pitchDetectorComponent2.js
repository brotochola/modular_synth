class PitchDetector2 extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.analyzer = app.actx.createAnalyser();

    this.analyzer.fftSize = 32768;

    this.bufferLength = this.analyzer.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    this.createAudioBufferNode();
    this.createNode();
    this.runloop();
  }

  createAudioBufferNode() {
    this.audioBufferNode = this.app.actx.createBufferSource();
    this.audioBuffer = this.app.actx.createBuffer(
      1,
      128,
      this.app.actx.sampleRate
    );

    this.samplesFromAudioBuffer = this.audioBuffer.getChannelData(0);
    // for (let i = 0; i < 128; i++) {
    //   nowBuffering[i] = this.inputFromWorklet[i];
    // }
    this.audioBufferNode.loop = true;
    this.audioBufferNode.buffer = this.audioBuffer;
    this.audioBufferNode.start();
    this.audioBufferNode.connect(this.analyzer);
    // this.audioBufferNode.connect(this.app.actx.destination)
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/pitchDetector2Worklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "pitch-worklet-2", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          // console.log("#pitch det 2", e.data.input);
          if (e.data.error) {
            console.warn("error in pitch 2", e.data.error);
          }
          if (e.data.input) {
            if (this.audioBuffer) {
              //   this.samplesFromAudioBuffer = this.audioBuffer.getChannelData(0);

              this.samplesFromAudioBuffer.set(e.data.input);
            }
          }
        };
      });
  }
  getFreqFromFFT() {
    let highestValue = getHighestItemFromArrObj(arrayToObject(this.dataArray));
    return (highestValue * this.app.actx.sampleRate) / this.analyzer.fftSize;
  }

  runloop() {
    if (!this.analyzer) return;
    this.analyzer.getByteFrequencyData(this.dataArray);

    // console.log("#freeq", this.getFreqFromFFT());
    if (this.node) {
      this.node.port.postMessage({ value: this.getFreqFromFFT() });
    }

    // canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    requestAnimationFrame(() => this.runloop());
  }
}
