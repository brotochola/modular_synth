class WebcamPlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pixelCount = 0;
    this.pixels = null;
    this.pixelLen = 0;
    this.port.onmessage = (e) => {
      this.pixels = e.data;
      this.pixelLen = this.pixels && this.pixels.length ? this.pixels.length / 4 : 0;
    };
  }

  process(inputs, outputs) {
    let pixels = this.pixels;
    let len = this.pixelLen;
    if (!len) return true;

    let blockLen = 0;
    for (let i = 0; i < outputs.length; i++) {
      let output = outputs[i];
      for (let v = 0; v < output.length; v++) {
        let channel = output[v];
        let n = channel.length;
        if (n > blockLen) blockLen = n;
        for (let c = 0; c < n; c++) {
          let idx = (this.pixelCount + c) % len;
          channel[c] = (pixels[idx * 4 + i] / 255) * 2 - 1;
        }
      }
    }
    this.pixelCount = (this.pixelCount + (blockLen || 128)) % len;
    return true;
  }
}

registerProcessor("webcam-player-worklet", WebcamPlayerWorklet);
