class ImagePlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pixelCount = 0;
    this.imageDataParsed = [];
    this.letters = ["r", "g", "b", "a"];
    this.port.onmessage = (e) => {
      this.imageDataParsed = e.data;
    };
  }

  process(inputs, outputs) {
    let pixels = this.imageDataParsed;
    let len = pixels.length;
    if (len === 0) return true;

    let blockLen = 0;
    for (let i = 0; i < outputs.length; i++) {
      let output = outputs[i];
      let letter = this.letters[i];
      for (let v = 0; v < output.length; v++) {
        let channel = output[v];
        let n = channel.length;
        if (n > blockLen) blockLen = n;
        for (let c = 0; c < n; c++) {
          let idx = (this.pixelCount + c) % len;
          if (i == 4) {
            channel[c] = idx < n ? 1 : 0;
          } else {
            channel[c] = (pixels[idx][letter] / 255) * 2 - 1;
          }
        }
      }
    }
    this.pixelCount = (this.pixelCount + (blockLen || 128)) % len;
    return true;
  }
}

registerProcessor("image-player-worklet", ImagePlayerWorklet);
