class SequentialSwitchWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "sequential-switch");
    this.step = 0;
    this.steps = 4;
    this.clockOn = 0;
    this.resetOn = 0;
    this.lastPosted = -1;
    this.src = [null, null, null, null];
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
    let out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let n = out.length;
    let clockCh = inputs[0] && inputs[0][0];
    let resetCh = inputs[1] && inputs[1][0];
    this.src[0] = inputs[2] && inputs[2][0];
    this.src[1] = inputs[3] && inputs[3][0];
    this.src[2] = inputs[4] && inputs[4][0];
    this.src[3] = inputs[5] && inputs[5][0];
    let prevC = this.clockOn;
    let prevR = this.resetOn;
    let step = this.step;
    let steps = this.steps;
    let changed = false;

    for (let i = 0; i < n; i++) {
      let ck = clockCh ? clockCh[i] : 0;
      let rs = resetCh ? resetCh[i] : 0;
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
      let src = this.src[step];
      out[i] = src ? src[i] : 0;
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

registerProcessor("sequential-switch-worklet", SequentialSwitchWorklet);
