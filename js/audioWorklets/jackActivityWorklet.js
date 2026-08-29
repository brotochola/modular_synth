class JackActivityWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "jack-activity");
    this.counter = 0;
  }

  process(inputs) {
    this.counter++;
    if (this.counter < 12) return true;
    this.counter = 0;
    let n = inputs.length;
    let levels = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      let ch = inputs[p] && inputs[p][0];
      if (!ch || !ch.length) {
        levels[p] = 0;
        continue;
      }
      // Last sample of quantum — signed bipolar level
      levels[p] = ch[ch.length - 1] || 0;
    }
    this.port.postMessage({ levels }, [levels.buffer]);
    return true;
  }
}

registerProcessor("jack-activity-worklet", JackActivityWorklet);
