class AiComponent2 extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.net = new brain.NeuralNetwork({
      activation: "sigmoid", // activation function
      hiddenLayers: [512, 128],
      iterations: 2000,
      learningRate: 0.5, // global learning rate, useful when training using streams
    });

    // const config = {
    //   // inputSize: 128,
    //   // inputRange: 20,
    //   hiddenLayers: [32],
    //   // outputSize: 128,
    //   learningRate: 0.5,
    //   decayRate: 0.999,
    // };
    this.size = 1024;
    // // create a simple recurrent neural network
    // this.net = new brain.recurrent.RNN(config);
    this.promises = [];
    this.lastTime = 0;
    this.trainCount = 0;
    this.maxTrainCount = 2;
    this.trainReady = false;
    this.createNode();
    this.run();
  }
  run() {
    this.deltaTime = this.app.actx.currentTime - this.lastTime;

    if (this.trainCount < this.maxTrainCount) {
      this.trainCount++;
      this.promises.push(
        this.net.trainAsync([
          {
            input: generateAnArrayWithRandomValues(
              this.size,
              Math.random() * 2 - 1
            ),
            output: generateAnArrayWithRandomValues(this.size),
          },
        ])
      );
    } else {
      //ALL TRAINING WAS SENT TO BE DONE

      Promise.all(this.promises).then((e) => {
        this.trainReady = true;
      });
      if (this.trainReady) this.generateAudio();
    }

    this.lastTime = this.app.actx.currentTime;
    requestAnimationFrame(() => this.run());
  }

  generateAudio() {
    const nowBuffering = this.audioBuffer.getChannelData(0);
    let val = this.net.run(
      generateAnArrayWithRandomValues(1024, Math.random())
    );
    for (let i = 0; i < this.size; i++) {
      nowBuffering[i] = val[i];
    }
  }

  train() {
    // console.log("training", this.trainCount);
    if ((this.prevChunk || []).length && (this.currentChunk || []).length) {
      try {
        this.net.train([{ input: this.prevChunk, output: this.currentChunk }]);
      } catch (e) {
        debugger;
      }
      this.trainCount++;
    }
  }

  //   run(chunk) {
  //     this.runTimes++;
  //     if (chunk.length != 128) {
  //       this.calculatedOutput = new Float32Array(128);
  //     } else {
  //       //run and reverse the process from before
  //       try {
  //         this.calculatedOutput = this.net.run(chunk).map((k) => {
  //           return (k - 0.5) * 2;
  //         });
  //       } catch (e) {
  //         debugger;
  //       }
  //     }
  //     // console.log(this.calculatedOutput);
  //     this.node.port.postMessage({
  //       chunk: this.calculatedOutput,
  //     });
  //   }

  createNode() {
    this.node = this.app.actx.createBufferSource();
    this.audioBuffer = this.app.actx.createBuffer(
      1,
      this.size,
      this.app.actx.sampleRate
    );

    const nowBuffering = this.audioBuffer.getChannelData(0);
    for (let i = 0; i < this.size; i++) {
      nowBuffering[i] = Math.random() * 2 - 1;
    }
    this.node.loop = true;
    this.node.buffer = this.audioBuffer;
    this.node.start();
  }
}
