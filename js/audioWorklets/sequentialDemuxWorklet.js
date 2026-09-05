class SequentialDemuxWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sequential-demux");
    this.step = 0;
    this.steps = 4;
    this.clockOn = 0;
    this.resetOn = 0;
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
    if (this.sab) this.sab.setNote(this.step);
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
    let prevC = this.clockOn;
    let prevR = this.resetOn;
    let step = this.step;
    let steps = this.steps;
    let changed = false;

    for (let i = 0; i < n; i++) {
      let ck = clockCh ? clockCh[i] : 0;
      let rs = resetCh ? resetCh[i] : 0;
      let sig = signalCh ? signalCh[i] : 0;
      let onR = AppConfig.schmitt(prevR, rs);
      let onC = AppConfig.schmitt(prevC, ck);
      if (onR && !prevR) {
        step = 0;
        changed = true;
      } else if (onC && !prevC) {
        step = (step + 1) % steps;
        changed = true;
      }
      prevC = onC;
      prevR = onR;

      for (let o = 0; o < 4; o++) {
        let ch = outputs[o] && outputs[o][0];
        if (!ch || i >= ch.length) continue;
        ch[i] = o === step && o < steps ? sig : 0;
      }
    }

    this.clockOn = prevC;
    this.resetOn = prevR;
    this.step = step;
    if (changed) this.postStep();
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, null);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("sequential-demux-worklet", SequentialDemuxWorklet);
