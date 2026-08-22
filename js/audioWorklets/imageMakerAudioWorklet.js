class imageMakerAudioWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.width = 215;
    this.height = 121;
    this.totalPixels = this.width * this.height;
    this.write = 0;
    this.allocFrame();
  }

  allocFrame() {
    this.frame = new Uint8ClampedArray(this.totalPixels * 4);
  }

  mapFrom0To255(val) {
    return Math.floor((val + 1) * 0.5 * 256);
  }

  process(inputs) {
    let n = 128;
    for (let ch = 0; ch < 4; ch++) {
      let channel = (inputs[ch] && inputs[ch][0]) || [];
      if (channel.length > n) n = channel.length;
    }

    for (let c = 0; c < n; c++) {
      let base = this.write * 4;
      for (let ch = 0; ch < 4; ch++) {
        let channel = (inputs[ch] && inputs[ch][0]) || [];
        if (channel.length) {
          this.frame[base + ch] = this.mapFrom0To255(channel[c]);
        } else {
          this.frame[base + ch] = ch == 3 ? 255 : 0;
        }
      }
      this.write++;
      if (this.write >= this.totalPixels) {
        // ponytail: one post per completed frame. Upgrade = SharedArrayBuffer ring if COOP/COEP.
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.allocFrame();
        this.write = 0;
      }
    }

    return true;
  }
}

registerProcessor("image-maker-worklet", imageMakerAudioWorklet);
