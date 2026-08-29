class PadSamplerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "pad-sampler");
    this.audioBuffer = new Float32Array(0);
    this.port.onmessage = (e) => {
      let src = e.data && e.data.audioBuffer;
      if (!src || !src.length) return;
      let n = src.length;
      let buf = new Float32Array(n * 2);
      buf.set(src);
      for (let i = 0; i < n; i++) buf[n + i] = src[n - 1 - i];
      this.audioBuffer = buf;
    };
    this.speed = new Float32Array(16);
    this.idx = new Float32Array(16);
    this.nVoices = 0;
  }

  process(inputs, outputs) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let nIn = inputs.length;
    if (nIn > this.speed.length) nIn = this.speed.length;
    this.nVoices = nIn;
    for (let i = 0; i < nIn; i++) {
      let ch = inputs[i] && inputs[i][0];
      let inputVal = ch && ch.length ? ch[0] : 0;
      this.speed[i] = inputVal;
      if (inputVal == 0) this.idx[i] = 0;
    }
    let buf = this.audioBuffer;
    let len = buf.length;
    if (!len) {
      output.fill(0);
      return true;
    }
    let n = output.length;
    for (let s = 0; s < n; s++) {
      let val = 0;
      let live = 0;
      for (let v = 0; v < nIn; v++) {
        let sp = this.speed[v];
        if (!sp) continue;
        live++;
        let ix = this.idx[v] + sp;
        if (ix >= len) ix = 0;
        else if (ix < 0) ix = len - 1;
        this.idx[v] = ix;
        val += buf[ix | 0];
      }
      output[s] = live ? val / live : 0;
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("pad-sampler", PadSamplerWorklet);
