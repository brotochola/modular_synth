class PerlinNoise extends Component {
  static name = "Perlin";
  static WIDTH = 128;
  static VIS_MAX = 256;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "2D Perlin. mode 0 loop: scan X, Y+=speed, wrap height. 1 infinite: same, Y never wraps. 2 walk: sample exact (x,y) — patch ramps/LFOs to move; still x,y = held CV. 3 row: Y CV picks the line (float), X scans 0..127 + x offset. Horizontal line / walk crosshair is the read point.";
    this._overlay = true;
    this.playY = 0;
    this.playX = 0;
    this._imgKey = "";
    this.createCanvas();
    this.createNode();
    this.startOverlayLoop();
  }

  getParamInputLimits(name) {
    if (name == "speed") return { min: 0, max: 64, step: 0.01 };
    if (name == "scale") return { min: 0.001, max: 1, step: 0.001 };
    if (name == "octaves") return { min: 1, max: 8, step: 1 };
    if (name == "persist") return { min: 0, max: 1, step: 0.01 };
    if (name == "seed") return { min: 0, max: 4294967295, step: 1 };
    if (name == "height") return { min: 2, max: 4096, step: 1 };
    if (name == "mode") return { min: 0, max: 3, step: 1 };
    if (name == "x") return { min: -4096, max: 4096, step: 0.01 };
    if (name == "y") return { min: -4096, max: 4096, step: 0.01 };
    return super.getParamInputLimits(name);
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = PerlinNoise.WIDTH;
    this.canvas.height = 128;
    this.canvas.classList.add("perlinCanvas");
    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/perlinNoiseWorklet.js").then(() => {
      this.node = this.makeWorklet("perlin-noise-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: {
          speed: 1,
          scale: 0.0625,
          octaves: 3,
          persist: 0.5,
          seed: 1,
          height: 128,
          mode: 0,
          x: 0,
          y: 0,
        },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
    });
  }

  paramValue(name, fallback) {
    if (this.node && this.node.parameters) {
      let p = this.node.parameters.get(name);
      if (p) return p.value;
    }
    return fallback;
  }

  startOverlayLoop() {
    let tick = () => {
      if (!this._overlay) return;
      this.drawFrame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  readParams() {
    let scale = this.paramValue("scale", 0.0625);
    if (!(scale > 0.001)) scale = 0.001;
    if (scale > 1) scale = 1;
    let octaves = this.paramValue("octaves", 3) | 0;
    if (octaves < 1) octaves = 1;
    if (octaves > 8) octaves = 8;
    let pers = this.paramValue("persist", 0.5);
    if (pers < 0) pers = 0;
    if (pers > 1) pers = 1;
    let seed = this.paramValue("seed", 1) | 0;
    let height = this.paramValue("height", 128);
    if (!(height > 2)) height = 2;
    if (height > 4096) height = 4096;
    let mode = (this.paramValue("mode", 0) + 0.5) | 0;
    if (mode < 0) mode = 0;
    if (mode > 3) mode = 3;
    let wrapX = mode != 2;
    let wrapY = mode == 0 || mode == 3;
    return { scale, octaves, pers, seed, height, mode, wrapX, wrapY };
  }

  drawNoise(p, viewX0, viewY0, visH) {
    let w = PerlinNoise.WIDTH;
    if (this.canvas.height != visH) {
      this.canvas.height = visH;
      this.imageData = this.ctx.createImageData(w, visH);
    }
    let data = this.imageData.data;
    let H = p.height;
    for (let j = 0; j < visH; j++) {
      let srcY = viewY0 + ((j + 0.5) * H) / visH;
      for (let i = 0; i < w; i++) {
        let v = PerlinNoise.fbm(
          viewX0 + i,
          srcY,
          p.scale,
          p.octaves,
          p.pers,
          p.seed,
          p.wrapX,
          p.wrapY,
          p.height,
        );
        let g = ((v + 1) * 0.5 * 255) | 0;
        if (g < 0) g = 0;
        if (g > 255) g = 255;
        let idx = (j * w + i) << 2;
        data[idx] = g;
        data[idx + 1] = g;
        data[idx + 2] = g;
        data[idx + 3] = 255;
      }
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  wrapFloat(v, p) {
    if (!(p > 0)) return v;
    v = v - Math.floor(v / p) * p;
    if (v < 0) v += p;
    return v;
  }

  drawFrame() {
    if (!this.ctx) return;
    let p = this.readParams();
    let H = p.height;
    let visH = H | 0;
    if (visH > PerlinNoise.VIS_MAX) visH = PerlinNoise.VIS_MAX;
    if (visH < 2) visH = 2;
    let y = this.playY;
    let x = this.playX;
    let viewY0 = 0;
    let viewX0 = 0;
    if (p.wrapY) {
      y = this.wrapFloat(y, H);
    } else {
      viewY0 = Math.floor(y / H) * H;
    }
    if (p.mode == 2) {
      viewX0 = Math.floor(x / PerlinNoise.WIDTH) * PerlinNoise.WIDTH;
    }
    let key =
      p.scale +
      "," +
      p.octaves +
      "," +
      p.pers +
      "," +
      p.seed +
      "," +
      H +
      "," +
      p.mode +
      "," +
      viewX0 +
      "," +
      viewY0 +
      "," +
      visH;
    if (key != this._imgKey) {
      this._imgKey = key;
      this.drawNoise(p, viewX0, viewY0, visH);
    } else {
      this.ctx.putImageData(this.imageData, 0, 0);
    }
    let lineY = ((y - viewY0) / H) * visH + 0.5;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255,255,255,0.85)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, lineY);
    this.ctx.lineTo(this.canvas.width, lineY);
    if (p.mode == 2) {
      let lineX = x - viewX0 + 0.5;
      this.ctx.moveTo(lineX, 0);
      this.ctx.lineTo(lineX, visH);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  onSabTick() {
    super.onSabTick();
    if (!this.sabBlock) return;
    this.playY = this.sabBlock.getSlot(0);
    this.playX = this.sabBlock.getSlot(1);
  }

  remove() {
    this._overlay = false;
    super.remove();
  }

  static wrapInt(i, p) {
    if (!(p > 0)) return i;
    let m = i % p;
    if (m < 0) m += p;
    return m;
  }

  static fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  static grad(hash, x, y) {
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

  static hash2(ix, iy, seed) {
    let n =
      Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) | 0;
    return Math.imul(n, 1274126177);
  }

  static perlin2(x, y, periodX, periodY, seed) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let fx = x - x0;
    let fy = y - y0;
    let x1 = x0 + 1;
    let y1 = y0 + 1;
    if (periodX > 0) {
      x0 = PerlinNoise.wrapInt(x0, periodX);
      x1 = PerlinNoise.wrapInt(x1, periodX);
    }
    if (periodY > 0) {
      y0 = PerlinNoise.wrapInt(y0, periodY);
      y1 = PerlinNoise.wrapInt(y1, periodY);
    }
    let u = PerlinNoise.fade(fx);
    let v = PerlinNoise.fade(fy);
    let aa = PerlinNoise.grad(PerlinNoise.hash2(x0, y0, seed), fx, fy);
    let ba = PerlinNoise.grad(PerlinNoise.hash2(x1, y0, seed), fx - 1, fy);
    let ab = PerlinNoise.grad(PerlinNoise.hash2(x0, y1, seed), fx, fy - 1);
    let bb = PerlinNoise.grad(PerlinNoise.hash2(x1, y1, seed), fx - 1, fy - 1);
    let x0v = aa + (ba - aa) * u;
    let x1v = ab + (bb - ab) * u;
    return x0v + (x1v - x0v) * v;
  }

  static fbm(x, y, scale, octaves, pers, seed, wrapX, wrapY, height) {
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
        PerlinNoise.perlin2(
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
}

// ponytail: wrap continuity self-check. Upgrade = shared module if worklet/main drift.
(function perlinSelfCheck() {
  let a = PerlinNoise.fbm(0, 10, 0.0625, 3, 0.5, 1, true, false, 128);
  let b = PerlinNoise.fbm(128, 10, 0.0625, 3, 0.5, 1, true, false, 128);
  let c = PerlinNoise.fbm(5, 0, 0.0625, 3, 0.5, 1, true, true, 64);
  let d = PerlinNoise.fbm(5, 64, 0.0625, 3, 0.5, 1, true, true, 64);
  if (Math.abs(a - b) > 1e-6 || Math.abs(c - d) > 1e-6) {
    console.error("perlin wrap self-check fail", a, b, c, d);
  }
})();
