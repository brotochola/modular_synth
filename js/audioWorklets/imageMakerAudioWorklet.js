class imageMakerAudioWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "image-maker");
    this.width = 215;
    this.height = 121;
    this.totalPixels = this.width * this.height;
    this.write = 0;
    this.which = 0;
  }

  mapFrom0To255(val) {
    return ((val + 1) * 0.5 * 256) | 0;
  }

  process(inputs) {
    let bulk = this.bulk;
    if (!bulk) return true;
    let n = 128;
    let chs = [null, null, null, null];
    for (let ch = 0; ch < 4; ch++) {
      chs[ch] = (inputs[ch] && inputs[ch][0]) || null;
      if (chs[ch] && chs[ch].length > n) n = chs[ch].length;
    }
    let off = bulk.bufOffset(this.which);
    let u8 = bulk.u8;
    for (let c = 0; c < n; c++) {
      let base = off + this.write * 4;
      for (let ch = 0; ch < 4; ch++) {
        let channel = chs[ch];
        if (channel) {
          u8[base + ch] = this.mapFrom0To255(channel[c]);
        } else {
          u8[base + ch] = ch == 3 ? 255 : 0;
        }
      }
      this.write++;
      if (this.write >= this.totalPixels) {
        bulk.publish(this.which);
        this.which ^= 1;
        this.write = 0;
        off = bulk.bufOffset(this.which);
      }
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("image-maker-worklet", imageMakerAudioWorklet);
