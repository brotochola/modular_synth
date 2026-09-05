class PerlinNoiseWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "speed",
        defaultValue: 1,
        minValue: 0,
        maxValue: 64,
        automationRate: "a-rate",
      },
      {
        name: "scale",
        defaultValue: 0.0625,
        minValue: 0.001,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "octaves",
        defaultValue: 3,
        minValue: 1,
        maxValue: 8,
        automationRate: "k-rate",
      },
      {
        name: "persist",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "seed",
        defaultValue: 1,
        minValue: 0,
        maxValue: 4294967295,
        automationRate: "k-rate",
      },
      {
        name: "height",
        defaultValue: 128,
        minValue: 2,
        maxValue: 4096,
        automationRate: "k-rate",
      },
      {
        name: "mode",
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        automationRate: "k-rate",
      },
      {
        name: "x",
        defaultValue: 0,
        minValue: -4096,
        maxValue: 4096,
        automationRate: "a-rate",
      },
      {
        name: "y",
        defaultValue: 0,
        minValue: -4096,
        maxValue: 4096,
        automationRate: "a-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "perlin");
    this.y = 0;
  }

  wrapInt(i, p) {
    if (!(p > 0)) return i;
    let m = i % p;
    if (m < 0) m += p;
    return m;
  }

  wrapFloat(v, p) {
    if (!(p > 0)) return v;
    v = v - Math.floor(v / p) * p;
    if (v < 0) v += p;
    return v;
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  grad(hash, x, y) {
    switch (hash & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      default:
        return -x - y;
    }
  }

  hash2(ix, iy, seed) {
    let n =
      Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) | 0;
    return Math.imul(n, 1274126177);
  }

  perlin2(x, y, periodX, periodY, seed) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let fx = x - x0;
    let fy = y - y0;
    let x1 = x0 + 1;
    let y1 = y0 + 1;
    if (periodX > 0) {
      x0 = this.wrapInt(x0, periodX);
      x1 = this.wrapInt(x1, periodX);
    }
    if (periodY > 0) {
      y0 = this.wrapInt(y0, periodY);
      y1 = this.wrapInt(y1, periodY);
    }
    let u = this.fade(fx);
    let v = this.fade(fy);
    let aa = this.grad(this.hash2(x0, y0, seed), fx, fy);
    let ba = this.grad(this.hash2(x1, y0, seed), fx - 1, fy);
    let ab = this.grad(this.hash2(x0, y1, seed), fx, fy - 1);
    let bb = this.grad(this.hash2(x1, y1, seed), fx - 1, fy - 1);
    let x0v = aa + (ba - aa) * u;
    let x1v = ab + (bb - ab) * u;
    return x0v + (x1v - x0v) * v;
  }

  fbm(x, y, scale, octaves, pers, seed, wrapX, wrapY, height) {
    let cellsX = Math.max(1, Math.round(128 * scale));
    let sx = cellsX / 128;
    let pX = wrapX ? cellsX : 0;
    let pY = 0;
    if (wrapY && height > 0) {
      pY = Math.max(1, Math.round(height * sx));
    }
    let nx = x * sx;
    let ny = y * sx;
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      sum +=
        amp *
        this.perlin2(
          nx * freq,
          ny * freq,
          pX > 0 ? pX * freq : 0,
          pY > 0 ? pY * freq : 0,
          seed,
        );
      norm += amp;
      amp *= pers;
      freq *= 2;
    }
    return norm > 0 ? sum / norm : 0;
  }

  process(inputs, outputs, parameters) {
    let output = outputs[0] && outputs[0][0];
    if (!output) return true;
    let n = output.length;
    let speeds = parameters.speed;
    let xs = parameters.x;
    let ys = parameters.y;
    let aSpeed = speeds.length > 1;
    let aX = xs.length > 1;
    let aY = ys.length > 1;
    let speed0 = speeds[0];
    let x0 = xs[0];
    let y0 = ys[0];
    let scale = parameters.scale[0];
    if (!(scale > 0.001)) scale = 0.001;
    if (scale > 1) scale = 1;
    let octaves = parameters.octaves[0] | 0;
    if (octaves < 1) octaves = 1;
    if (octaves > 8) octaves = 8;
    let pers = parameters.persist[0];
    if (pers < 0) pers = 0;
    if (pers > 1) pers = 1;
    let seed = parameters.seed[0] | 0;
    let height = parameters.height[0];
    if (!(height > 2)) height = 2;
    if (height > 4096) height = 4096;
    let mode = (parameters.mode[0] + 0.5) | 0;
    if (mode < 0) mode = 0;
    if (mode > 3) mode = 3;
    let wrapX = mode != 2;
    let wrapY = mode == 0 || mode == 3;
    let yPlay = this.y;
    let lastX = x0;
    let lastY = y0;
    for (let i = 0; i < n; i++) {
      let xi = aX ? xs[i] : x0;
      let yi = aY ? ys[i] : y0;
      let px;
      let py;
      if (mode == 2) {
        px = xi;
        py = yi;
      } else if (mode == 3) {
        px = i + xi;
        py = wrapY ? this.wrapFloat(yi, height) : yi;
      } else {
        let sp = aSpeed ? speeds[i] : speed0;
        if (sp < 0) sp = 0;
        px = i + xi;
        py = yPlay;
        yPlay += sp / n;
        if (mode == 0) yPlay = this.wrapFloat(yPlay, height);
      }
      output[i] = this.fbm(
        px,
        py,
        scale,
        octaves,
        pers,
        seed,
        wrapX,
        wrapY,
        height,
      );
      lastX = px;
      lastY = py;
    }
    this.y = yPlay;
    if (this.sab) {
      this.sab.setSlot(0, lastY);
      this.sab.setSlot(1, lastX);
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("perlin-noise-worklet", PerlinNoiseWorklet);
