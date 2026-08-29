class Mulberry32Worklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "seed",
        defaultValue: 0,
        minValue: 0,
        maxValue: 4294967295,
        automationRate: "a-rate",
      },
    ];
  }

  constructor(options) {
    super();
    this.bipolar = !!(
      options &&
      options.processorOptions &&
      options.processorOptions.bipolar
    );
    this.port.onmessage = (e) => {
      if (e.data && e.data.bipolar !== undefined) {
        this.bipolar = !!e.data.bipolar;
      }
    };
  }

  /** One mulberry32 step from seed — pure hash, no lingering state. */
  hash(seed) {
    let a = (seed >>> 0) + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  process(_inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let seeds = parameters.seed;
    let bipolar = this.bipolar;
    let n = output.length;
    if (seeds.length === 1) {
      let u = this.hash(seeds[0]);
      let v = bipolar ? u * 2 - 1 : u;
      for (let i = 0; i < n; i++) output[i] = v;
    } else {
      for (let i = 0; i < n; i++) {
        let u = this.hash(seeds[i]);
        output[i] = bipolar ? u * 2 - 1 : u;
      }
    }
    return true;
  }
}

registerProcessor("mulberry32-worklet", Mulberry32Worklet);
