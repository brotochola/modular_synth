class WebcamPlayerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "webcam-player");
    this.pixelCount = 0;
    this.lastSeq = -1;
    this.pixels = null;
    this.pixelLen = 0;
  }

  process(inputs, outputs) {
    let bulk = this.bulk;
    if (bulk) {
      let seq = bulk.seq();
      if (seq !== this.lastSeq) {
        this.lastSeq = seq;
        let off = bulk.bufOffset(bulk.which());
        this.pixels = bulk.u8.subarray(off, off + bulk.byteLength);
        this.pixelLen = (this.pixels.length / 4) | 0;
      }
    }
    let pixels = this.pixels;
    let len = this.pixelLen;
    if (!len) return true;
    let inv = 1 / 255;
    let idx = this.pixelCount;
    let blockLen = 0;
    for (let i = 0; i < outputs.length; i++) {
      let output = outputs[i];
      if (!output) continue;
      let channel = output[0];
      if (!channel) continue;
      let n = channel.length;
      if (n > blockLen) blockLen = n;
      let p = idx;
      for (let c = 0; c < n; c++) {
        if (p >= len) p = 0;
        channel[c] = pixels[p * 4 + i] * inv * 2 - 1;
        p++;
      }
    }
    idx += blockLen || 128;
    while (idx >= len) idx -= len;
    this.pixelCount = idx;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("webcam-player-worklet", WebcamPlayerWorklet);
