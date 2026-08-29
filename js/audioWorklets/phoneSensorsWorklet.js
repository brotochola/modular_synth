class PhoneSensorsWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "phone-sensors");
    this.values = [0, 0, 0, 0, 0, 0, 0];
    this.port.onmessage = (e) => {
      let v = e.data && e.data.values;
      if (v && v.length) this.values = v;
    };
  }

  process(inputs, outputs) {
    let vals = this.values;
    for (let o = 0; o < outputs.length; o++) {
      let ch = outputs[o] && outputs[o][0];
      if (!ch) continue;
      let val = vals[o] || 0;
      for (let i = 0; i < ch.length; i++) ch[i] = val;
    }
    return true;
  }
}

registerProcessor("phone-sensors-worklet", PhoneSensorsWorklet);
