class SequentialSwitchWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
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
    let out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let n = out.length;
    let clockCh = inputs[0] && inputs[0][0];
    let resetCh = inputs[1] && inputs[1][0];
    let prevC = this.prevClock;
    let prevR = this.prevReset;
    let step = this.step;
    let steps = this.steps;
    let changed = false;

    for (let i = 0; i < n; i++) {
      let ck = clockCh ? clockCh[i] : 0;
      let rs = resetCh ? resetCh[i] : 0;
      if (prevR < 0.5 && rs >= 0.5) {
        step = 0;
        changed = true;
      } else if (prevC < 0.5 && ck >= 0.5) {
        step = (step + 1) % steps;
        changed = true;
      }
      prevC = ck;
      prevR = rs;

      let src = inputs[step + 2] && inputs[step + 2][0];
      out[i] = src ? src[i] || 0 : 0;
    }

    this.prevClock = prevC;
    this.prevReset = prevR;
    this.step = step;
    if (changed) this.postStep();
    return true;
  }
}

registerProcessor("sequential-switch-worklet", SequentialSwitchWorklet);
