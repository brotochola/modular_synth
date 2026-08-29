class SequentialDemuxWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sequential-demux");
    this.step = 0;
    this.steps = 4;
    this.prevClock = 0;
    this.prevReset = 0;
    this.lastPosted = -1;
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.steps != null) {
        let n = Math.round(Number(d.steps));
        if (n < 2) n = 2;
        if (n > 4) n = 4;
        this.steps = n;
        if (this.step >= this.steps) this.step = 0;
        this.postStep();
      }
    };
  }

  postStep() {
    if (this.step === this.lastPosted) return;
    this.lastPosted = this.step;
    this.port.postMessage({ step: this.step });
  }

  process(inputs, outputs) {
    let clockCh = inputs[0] && inputs[0][0];
    let resetCh = inputs[1] && inputs[1][0];
    let signalCh = inputs[2] && inputs[2][0];
    let n = 128;
    for (let o = 0; o < outputs.length; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (ch && ch.length > n) n = ch.length;
    }
    let prevC = this.prevClock;
    let prevR = this.prevReset;
    let step = this.step;
    let steps = this.steps;
    let changed = false;

    for (let i = 0; i < n; i++) {
      let ck = clockCh ? clockCh[i] : 0;
      let rs = resetCh ? resetCh[i] : 0;
      let sig = signalCh ? signalCh[i] : 0;
      if (AppConfig.isRising(prevR, rs)) {
        step = 0;
        changed = true;
      } else if (AppConfig.isRising(prevC, ck)) {
        step = (step + 1) % steps;
        changed = true;
      }
      prevC = ck;
      prevR = rs;

      for (let o = 0; o < 4; o++) {
        let ch = outputs[o] && outputs[o][0];
        if (!ch || i >= ch.length) continue;
        ch[i] = o === step && o < steps ? sig : 0;
      }
    }

    this.prevClock = prevC;
    this.prevReset = prevR;
    this.step = step;
    if (changed) this.postStep();
    return true;
  }
}

registerProcessor("sequential-demux-worklet", SequentialDemuxWorklet);
