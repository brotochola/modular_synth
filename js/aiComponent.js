class AiComponent extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.net = new brain.NeuralNetwork({
      activation: "sigmoid", // activation function
      hiddenLayers: [64, 32, 16],
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

    // // create a simple recurrent neural network
    // this.net = new brain.recurrent.RNN(config);
    this.runTimes = 0;
    this.trainCount = 0;
    this.gatheringDataReady = false;
    this.trainingReady = false;
    this.minDataToGather = 1;
    this.dataToTrain = [];
 
    this.createDisplay();
    this.createNode();
    this.changeStateInDisplay("idle");
  }

  changeStateInDisplay(state) {
    this.state = state;
    this.display.innerHTML = state;
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/brainjsWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "ai-worklet", {
          numberOfInputs: 2,
          numberOfOutputs: 1,
        });
        // this.node.port.postMessage({ bpm: this.app.bpm });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          if (e.data.state) {
            this.changeStateInDisplay(e.data.state);
          }
        };
      });
  }
}
