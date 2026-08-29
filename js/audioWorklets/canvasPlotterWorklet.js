class CanvasPlotterWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "clear", defaultValue: 0, minValue: 0, maxValue: 100, automationRate: "k-rate" },
      { name: "time", defaultValue: 0, minValue: 0, maxValue: 10, automationRate: "k-rate" },
      { name: "range", defaultValue: 1, minValue: 1, maxValue: 1000, automationRate: "k-rate" },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "canvas-plotter");
    this.lastProcessTime = 0;
    this.sx = 0;
    this.sy = 0;
    this.sr = 0;
    this.sg = 0;
    this.sb = 0;
    this.inited = false;
    this.ringWrite = 0;
  }

  lastSample(input) {
    let ch = input && input[0];
    if (!ch || !ch.length) return 0;
    return ch[ch.length - 1] || 0;
  }

  process(inputs, _outputs, parameters) {
    let tx = this.lastSample(inputs[0]);
    let ty = this.lastSample(inputs[1]);
    let tr = this.lastSample(inputs[2]);
    let tg = this.lastSample(inputs[3]);
    let tb = this.lastSample(inputs[4]);

    let dt = currentTime - this.lastProcessTime;
    this.lastProcessTime = currentTime;
    if (!(dt > 0) || dt > 0.1) dt = 128 / sampleRate;

    let time = parameters.time[0];
    if (isNaN(time) || time < 0) time = 0;

    if (!this.inited || time < 1e-6) {
      this.sx = tx;
      this.sy = ty;
      this.sr = tr;
      this.sg = tg;
      this.sb = tb;
      this.inited = true;
    } else {
      let a = 1 - Math.exp(-dt / time);
      this.sx += (tx - this.sx) * a;
      this.sy += (ty - this.sy) * a;
      this.sr += (tr - this.sr) * a;
      this.sg += (tg - this.sg) * a;
      this.sb += (tb - this.sb) * a;
    }

    let clear = parameters.clear[0];
    if (isNaN(clear)) clear = 0;

    let sab = this.sab;
    if (sab) {
      sab.setSlot(0, this.sx);
      sab.setSlot(1, this.sy);
      sab.setSlot(2, this.sr);
      sab.setSlot(3, this.sg);
      sab.setSlot(4, this.sb);
      sab.setSlot(5, clear);
      let dense = sab.getSlot(6) > 0.5;
      if (dense) {
        let cap = AppConfig.SAB_RING_CAP;
        let stride = AppConfig.SAB_RING_STRIDE;
        let w = Atomics.load(sab.i32, AppConfig.SAB_I_BULK_WRITE);
        let base = AppConfig.SAB_RING_BASE + (w % cap) * stride;
        sab.f32[base] = this.sx;
        sab.f32[base + 1] = this.sy;
        sab.f32[base + 2] = this.sr;
        sab.f32[base + 3] = this.sg;
        sab.f32[base + 4] = this.sb;
        sab.f32[base + 5] = clear;
        Atomics.store(sab.i32, AppConfig.SAB_I_BULK_WRITE, w + 1);
      }
      AppConfig.sabWriteGraphPeaks(sab, inputs, parameters);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("canvas-plotter-worklet", CanvasPlotterWorklet);
