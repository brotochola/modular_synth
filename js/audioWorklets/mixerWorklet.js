function mixerParamDescriptors(n) {
  let d = [];
  for (let i = 0; i < n; i++) {
    d.push({ name: "g" + i, defaultValue: 1, minValue: 0, maxValue: 2 });
  }
  d.push({ name: "master", defaultValue: 1, minValue: 0, maxValue: 2 });
  return d;
}

function MixerWorkletClass(nch) {
  let descriptors = mixerParamDescriptors(nch);
  return class MixerWorklet extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return descriptors;
    }

    constructor(options) {
      super();
      AppConfig.bindProcessorSab(this, options);
      if (globalThis.AudioProfile) AudioProfile.attach(this, "mixer");
      this.lastPostTime = 0;
      this.nch = nch;
      this.chans = new Array(nch);
      this.gainsArr = new Array(nch);
      this.gk = new Array(nch);
      this.gv = new Array(nch);
    }

    process(inputs, outputs, parameters) {
      const out = outputs[0] && outputs[0][0];
      if (!out) return true;
      const nch = this.nch;
      const master = parameters.master;
      const mk = master.length === 1;
      const vm = mk ? master[0] : 0;
      const n = out.length;
      const chans = this.chans;
      const gains = this.gainsArr;
      const gk = this.gk;
      const gv = this.gv;
      for (let c = 0; c < nch; c++) {
        chans[c] = inputs[c] && inputs[c][0];
        let g = parameters["g" + c];
        gains[c] = g;
        gk[c] = g.length === 1;
        gv[c] = gk[c] ? g[0] : 0;
      }
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let c = 0; c < nch; c++) {
          let x = chans[c] ? chans[c][i] : 0;
          sum += x * (gk[c] ? gv[c] : gains[c][i]);
        }
        out[i] = sum * (mk ? vm : master[i]);
      }

      if (this.sab && currentTime - this.lastPostTime >= 1 / 20) {
        this.lastPostTime = currentTime;
        for (let c = 0; c < nch; c++) {
          let g = gains[c];
          this.sab.setSlot(c, g[g.length - 1]);
        }
        this.sab.setSlot(nch, master[master.length - 1]);
        this.sab.publish();
      }
      if (this.sab) AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      return true;
    }
  };
}

registerProcessor("mixer-worklet-4", MixerWorkletClass(4));
registerProcessor("mixer-worklet-8", MixerWorkletClass(8));
registerProcessor("mixer-worklet-16", MixerWorkletClass(16));
registerProcessor("mixer-worklet", MixerWorkletClass(8));
