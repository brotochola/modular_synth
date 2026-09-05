class AdsrProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "adsr");
    this._lastGate = 0;
    this._gate = 0;
    this._phase = 0;
    this._value = 0;
    this._atk = -1;
    this._dec = -1;
    this._rel = -1;
    this._curve = -1;
    this._atkmax = 1;
    this._atkRatio = 0;
    this._decRatio = 0;
    this._relRatio = 0;
  }
  static get parameterDescriptors() {
    return [
      { name: "gate", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "a-rate" },
      { name: "attack", defaultValue: 0.1, minValue: 0, maxValue: 60, automationRate: "k-rate" },
      { name: "decay", defaultValue: 0, minValue: 0, maxValue: 60, automationRate: "k-rate" },
      { name: "sustain", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "release", defaultValue: 0, minValue: 0, maxValue: 60, automationRate: "k-rate" },
      { name: "attackcurve", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    const gates = parameters.gate;
    const dec = parameters.decay[0];
    const sus = parameters.sustain[0];
    const rel = parameters.release[0];
    const atk = parameters.attack[0];
    const curve = parameters.attackcurve[0];
    if (atk !== this._atk || curve !== this._curve) {
      this._atk = atk;
      this._curve = curve;
      this._atkmax = 1.01 / Math.max(0.01, curve);
      this._atkRatio = 1 - Math.pow(1 - 1 / this._atkmax, 1 / (sampleRate * atk));
    }
    if (dec !== this._dec) {
      this._dec = dec;
      this._decRatio = 1 - Math.pow(0.36787944, 1 / (sampleRate * dec));
    }
    if (rel !== this._rel) {
      this._rel = rel;
      this._relRatio = 1 - Math.pow(0.36787944, 1 / (sampleRate * rel));
    }
    let atkmax = this._atkmax;
    let atkRatio = this._atkRatio;
    let decRatio = this._decRatio;
    let relRatio = this._relRatio;
    if (gates.length == 1) this._gate = gates[0];
    let prev = this._lastGate;
    let phase = this._phase;
    let value = this._value;
    let aRate = gates.length > 1;
    let thr = 0.001;
    for (let i = 0; i < output.length; ++i) {
      let g = aRate ? gates[i] : this._gate;
      if (g >= thr) {
        if (prev < thr) {
          phase = 1;
          value = 0;
        }
      } else phase = 0;
      if (phase == 1) {
        if ((value += (atkmax - value) * atkRatio) >= 1.0) {
          value = 1.0;
          phase = 0;
        }
      } else if (value > sus) {
        value += (sus - value) * decRatio;
      }
      if (g < thr) {
        value += -value * relRatio;
      }
      output[i] = value;
      prev = g;
    }
    this._lastGate = prev;
    this._gate = prev;
    this._phase = phase;
    this._value = value;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("adsr-worklet", AdsrProcessor);
