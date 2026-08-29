class ScanlineWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "frequency",
        defaultValue: 110,
        minValue: 0,
        maxValue: 2000,
        automationRate: "a-rate",
      },
      {
        name: "row",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "scanline");
    this.width = 0;
    this.height = 0;
    this.luma = null;
    this.phase = 0;
    this.port.onmessage = (e) => {
      let d = e.data || {};
      if (d.luma) {
        this.width = d.width || 0;
        this.height = d.height || 0;
        this.luma = d.luma;
      }
    };
  }

  sampleAt(x, y) {
    let luma = this.luma;
    let w = this.width;
    let h = this.height;
    if (!luma || w < 2 || h < 2) return 0.5;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > w - 1) x = w - 1;
    if (y > h - 1) y = h - 1;
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = x0 + 1 < w ? x0 + 1 : w - 1;
    let y1 = y0 + 1 < h ? y0 + 1 : h - 1;
    let fx = x - x0;
    let fy = y - y0;
    let a = luma[y0 * w + x0];
    let b = luma[y0 * w + x1];
    let c = luma[y1 * w + x0];
    let d = luma[y1 * w + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let freqs = parameters.frequency;
    let rows = parameters.row;
    let freq0 = freqs[0];
    let row0 = rows[0];
    let aFreq = freqs.length > 1;
    let aRow = rows.length > 1;
    let w = this.width;
    let h = this.height;
    let phase = this.phase;
      if (!this.luma || w < 2 || h < 2) {
      output.fill(0);
      return true;
    }
    let invSr = 1 / sampleRate;
    for (let i = 0; i < n; i++) {
      let freq = aFreq ? freqs[i] : freq0;
      let row = aRow ? rows[i] : row0;
      if (freq < 0) freq = 0;
      phase += freq * invSr;
      phase -= Math.floor(phase);
      let x = phase * (w - 1);
      if (row < 0) row = 0;
      if (row > 1) row = 1;
      let y = row * (h - 1);
      output[i] = this.sampleAt(x, y) * 2 - 1;
    }
    this.phase = phase;
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("scanline-worklet", ScanlineWorklet);
