class imageMakerAudioWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      console.log(e.data);
    };
  }

  mapFrom0To255(val) {
    //THEY GO FROM -1 TO 1
    //SO +1 TAKES IT TO 0 TO 2
    //AND *0.5 TAKES IT TO 0 AND 1
    //THEN MULTIPLY IT BY 255 AND FLOOR IT
    return Math.floor((val + 1) * 0.5 * 256);
  }

  process(inputs, outputs) {
    this.port.postMessage(
      inputs.map((input) => {
        return input.map((channel) => {
          return channel.map((k) => this.mapFrom0To255(k));
        });
      })
    );
    // //bypass the audio
    // outputs = inputs;

    // let inputCount = 0;
    // for (let input of inputs) {
    //   let channelCount = 0;
    //   for (let channel of input) {
    //     this.port.postMessage({
    //       input: inputCount,
    //       channel: channelCount,
    //       channelData: channel.map((k) => this.mapFrom0To255(k)),
    //     });
    //     channelCount++;
    //   }
    //   inputCount++;
    // }

    ///////
    // let inputR = (inputs || [])[0] || [];
    // let inputG = (inputs || [])[1] || [];
    // let inputB = (inputs || [])[2] || [];
    // let inputA = (inputs || [])[3] || [];

    return true;
  }
}

registerProcessor("image-maker-worklet", imageMakerAudioWorklet);
