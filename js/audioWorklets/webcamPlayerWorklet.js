class WebcamPlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pixelCount = 0;
    this.imageDataParsed = [];
    this.port.onmessage = (e) => {
      // console.log(e.data);
      this.imageDataParsed = e.data;
    //   this.port.postMessage({
    //     msg: "el worklet del imageplayer recibio la data..",
    //   });
    };
  }

  imageValueToAudioValue(val) {
    return (val / 255) * 2 - 1;
  }

  process(inputs, outputs) {
    if (this.imageDataParsed.length == 0) {
      return true;
    }
    // this.port.postMessage(outputs)
    for (let i = 0; i < outputs.length; i++) {
      let output = outputs[i];
      for (let v = 0; v < output.length; v++) {
        let channel = output[v];
        for (let c = 0; c < channel.length; c++) {
          let idx = (this.pixelCount + c) % this.imageDataParsed.length;
      
          if (i == 4) {
            //SYNC OUTPUT
            if (idx < 128) {
              channel[c] = 1;
            }
          } else {
            try {
              let letter = i == 0 ? "r" : i == 1 ? "g" : i == 2 ? "b" : "a";
              let pixValue = this.imageDataParsed[idx][letter];
              // this.port.postMessage({
              //   c,
              //   thisPixel: this.imageDataParsed[this.pixelCount + c],
              //   pixValue,
              // });
              channel[c] = this.imageValueToAudioValue(pixValue);
            } catch (e) {
              this.port.postMessage({
                error: e,
                c: this.pixelCount + c,
                length: this.imageDataParsed.length,
              });
            }
          }
        }
      }
    }

    this.pixelCount = (this.pixelCount + 128) % this.imageDataParsed.length;
    // this.port.postMessage({ pixelCount:this.pixelCount });
    // this.port.postMessage({
    //   pxlcnt: this.pixelCount,
    //   total: this.imageDataParsed.length,
    // });
    // if (this.pixelCount >= this.imageDataParsed.length) {
    //   this.pixelCount = this.pixelCount - this.imageDataParsed.length;
    // }

    // outputs=outputs.map((output, numOutput) => {
    //   return output.map((channel) => {
    //     return channel.map((k, i) => {
    //       // this.port.postMessage({k,i})
    //       return Math.random();

    //       // return this.imageValueToAudioValue(
    //       //   this.imageDataParsed[i][
    //       //     numOutput == 0
    //       //       ? "r"
    //       //       : numOutput == 1
    //       //       ? "g"
    //       //       : numOutput == 2
    //       //       ? "b"
    //       //       : "a"
    //       //   ]
    //       // );
    //     });
    //   });
    // });

    //bypass the audio

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

registerProcessor("webcam-player-worklet", WebcamPlayerWorklet);
