class JackActivityWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "jack-activity");
    this.counter = 0;
    this.peaks = null;
  }

  process(inputs) {
    let n = inputs.length;
    if (!this.peaks || this.peaks.length !== n) {
      this.peaks = new Float32Array(n);
    }
    for (let p = 0; p < n; p++) {
      let ch = inputs[p] && inputs[p][0];
      if (!ch || !ch.length) continue;
      let peak = this.peaks[p];
      for (let i = 0; i < ch.length; i++) {
        let v = ch[i];
        if (Math.abs(v) > Math.abs(peak)) peak = v;
      }
      this.peaks[p] = peak;
    }
    this.counter++;
    if (this.counter < 12) return true;
    this.counter = 0;
    let levels = this.peaks;
    this.peaks = new Float32Array(n);
    this.port.postMessage({ levels }, [levels.buffer]);
    return true;
  }
}

registerProcessor("jack-activity-worklet", JackActivityWorklet);
