class CanvasPlotter extends Component {
  static name = "Canvas Plotter";
  static STRIDE = 5;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.width = 320;
    this.height = 180;
    this.infoText =
      "Canvas Plotter — visual only, no audio output.\n\n" +
      "Inputs: x, y, R, G, B (CV). The pen draws a continuous stroke on the canvas.\n" +
      "• bipolar (checkbox, default on): input domain is [-range, +range]; 0 is center. Off = unipolar [0, range]; 0 is min edge / black.\n" +
      "• range (1–1000, default 1): absolute max of that domain. Patchable.\n" +
      "After clamp, values go through Hermite smoothstep, then to pixels / 0–255 RGB.\n" +
      "• time (s): slew x/y/R/G/B toward new CV (0 = instant).\n" +
      "• clear (0–100): each display frame fades the canvas with that alpha (trail).\n" +
      "• last only (checkbox, default off): off = draw every sample queued since last frame (~audio-rate density). On = each frame uses only the latest sample (~60 fps).\n" +
      "Worklet samples CV every audio quantum; main thread draws on requestAnimationFrame.";
    this.valuesToSave = ["bipolar", "lastOnly"];
    this.bipolar =
      serializedData && serializedData.bipolar !== undefined
        ? !!serializedData.bipolar
        : true;
    this.lastOnly =
      serializedData && serializedData.lastOnly !== undefined
        ? !!serializedData.lastOnly
        : false;
    this.hasPoint = false;
    this.lastPx = 0;
    this.lastPy = 0;
    this.pending = new Float32Array(256 * CanvasPlotter.STRIDE);
    this.pendingCount = 0;
    this.pendingClear = 0;
    this._looping = false;
    this.createCanvas();
    this.createToggles();
    this.createNode();
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.classList.add("canvasPlotterCanvas");
    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  createToggles() {
    this.toggleWrap = document.createElement("div");
    this.toggleWrap.classList.add("plotterToggles");

    this.bipolarLabel = document.createElement("label");
    this.bipolarCheck = document.createElement("input");
    this.bipolarCheck.type = "checkbox";
    this.bipolarCheck.checked = !!this.bipolar;
    this.bipolarCheck.onchange = () => {
      this.bipolar = this.bipolarCheck.checked;
      this.quickSave();
    };
    this.bipolarLabel.appendChild(this.bipolarCheck);
    this.bipolarLabel.appendChild(document.createTextNode(" bipolar"));

    this.lastOnlyLabel = document.createElement("label");
    this.lastOnlyCheck = document.createElement("input");
    this.lastOnlyCheck.type = "checkbox";
    this.lastOnlyCheck.checked = !!this.lastOnly;
    this.lastOnlyCheck.onchange = () => {
      this.lastOnly = this.lastOnlyCheck.checked;
      if (this.sabBlock) {
        this.sabBlock.setSlot(6, this.lastOnly ? 0 : 1);
        this.sabBlock.publish();
      }
      this.quickSave();
    };
    this.lastOnlyLabel.appendChild(this.lastOnlyCheck);
    this.lastOnlyLabel.appendChild(document.createTextNode(" last only"));

    this.toggleWrap.appendChild(this.bipolarLabel);
    this.toggleWrap.appendChild(this.lastOnlyLabel);
    (this.main || this.container).appendChild(this.toggleWrap);
  }

  createNode() {
    this.app
      .loadWorklet("js/audioWorklets/canvasPlotterWorklet.js")
      .then(() => {
        this.node = this.makeWorklet("canvas-plotter-worklet",
          {
            numberOfInputs: 5,
            numberOfOutputs: 0,
            parameterData: { clear: 0, time: 0, range: 1 },
          },
        );
        this.node.onprocessorerror = (e) => {
          console.error(e);
        };
        this.startLoop();
      });
  }

  getParamInputLimits(name) {
    if (name == "clear") return { min: 0, max: 100, step: 1 };
    if (name == "time") return { min: 0, max: 10, step: 0.001 };
    if (name == "range") return { min: 1, max: 1000, step: 1 };
    return super.getParamInputLimits(name);
  }

  putLabels() {
    super.putLabels();
    let labels = ["x", "y", "R", "G", "B"];
    for (let i = 0; i < labels.length; i++) {
      let btn = this.container.querySelector("button.in_" + i);
      if (!btn) continue;
      btn.innerText = labels[i];
      btn.title = labels[i];
    }
    if (this.bipolarCheck) this.bipolarCheck.checked = !!this.bipolar;
    if (this.lastOnlyCheck) this.lastOnlyCheck.checked = !!this.lastOnly;
  }

  getRange() {
    let p = this.node && this.node.parameters && this.node.parameters.get("range");
    let max = p ? p.value : 1;
    if (!(max > 0) || isNaN(max)) max = 1;
    return max;
  }

  /** clamp to domain, normalize 0..1, Hermite smoothstep */
  mapInput(v) {
    let max = this.getRange();
    let t;
    if (this.bipolar) {
      t = (v + max) / (2 * max);
    } else {
      t = v / max;
    }
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  ensurePendingCapacity(needSamples) {
    let need = needSamples * CanvasPlotter.STRIDE;
    if (need <= this.pending.length) return;
    let next = this.pending.length;
    while (next < need) next *= 2;
    let grown = new Float32Array(next);
    grown.set(this.pending.subarray(0, this.pendingCount * CanvasPlotter.STRIDE));
    this.pending = grown;
  }

  onWorkletMessage(data) {
    if (!(data instanceof Float32Array) || data.length < 6) return;
    this.pendingClear = data[5];
    this.ensurePendingCapacity(this.pendingCount + 1);
    let i = this.pendingCount * CanvasPlotter.STRIDE;
    this.pending[i] = data[0];
    this.pending[i + 1] = data[1];
    this.pending[i + 2] = data[2];
    this.pending[i + 3] = data[3];
    this.pending[i + 4] = data[4];
    this.pendingCount++;
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    if (this.lastOnly) {
      this.pendingClear = sab.getSlot(5);
      this.ensurePendingCapacity(1);
      this.pending[0] = sab.getSlot(0);
      this.pending[1] = sab.getSlot(1);
      this.pending[2] = sab.getSlot(2);
      this.pending[3] = sab.getSlot(3);
      this.pending[4] = sab.getSlot(4);
      this.pendingCount = 1;
      return;
    }
    let w = Atomics.load(sab.i32, AppConfig.SAB_I_BULK_WRITE);
    let r = this._sabRingRead || 0;
    let cap = AppConfig.SAB_RING_CAP;
    let stride = AppConfig.SAB_RING_STRIDE;
    let n = w - r;
    if (n > cap) {
      r = w - cap;
    }
    if (n <= 0) return;
    this.ensurePendingCapacity(this.pendingCount + n);
    while (r < w) {
      let base = AppConfig.SAB_RING_BASE + (r % cap) * stride;
      this.pendingClear = sab.f32[base + 5];
      let i = this.pendingCount * CanvasPlotter.STRIDE;
      this.pending[i] = sab.f32[base];
      this.pending[i + 1] = sab.f32[base + 1];
      this.pending[i + 2] = sab.f32[base + 2];
      this.pending[i + 3] = sab.f32[base + 3];
      this.pending[i + 4] = sab.f32[base + 4];
      this.pendingCount++;
      r++;
    }
    this._sabRingRead = w;
  }

  startLoop() {
    if (this._looping) return;
    this._looping = true;
    this.loop();
  }

  loop() {
    if (!this.ctx || !this.app) {
      this._looping = false;
      return;
    }
    this.flushPending();
    requestAnimationFrame(() => this.loop());
  }

  drawSample(buf, i) {
    let px = this.mapInput(buf[i]) * (this.width - 1);
    let py = (1 - this.mapInput(buf[i + 1])) * (this.height - 1);
    let r = Math.floor(this.mapInput(buf[i + 2]) * 255);
    let g = Math.floor(this.mapInput(buf[i + 3]) * 255);
    let b = Math.floor(this.mapInput(buf[i + 4]) * 255);

    if (!this.hasPoint) {
      this.lastPx = px;
      this.lastPy = py;
      this.hasPoint = true;
      return;
    }

    this.ctx.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPx, this.lastPy);
    this.ctx.lineTo(px, py);
    this.ctx.stroke();
    this.lastPx = px;
    this.lastPy = py;
  }

  flushPending() {
    let n = this.pendingCount;
    if (!n) return;

    let alpha = (this.pendingClear || 0) / 100;
    if (alpha > 0) {
      if (alpha > 1) alpha = 1;
      this.ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    let stride = CanvasPlotter.STRIDE;
    let buf = this.pending;
    if (this.lastOnly) {
      this.drawSample(buf, (n - 1) * stride);
    } else {
      for (let s = 0; s < n; s++) {
        this.drawSample(buf, s * stride);
      }
    }

    this.pendingCount = 0;
  }
}

// ponytail: mapping self-check (bipolar range=1). Upgrade = formal test if math grows.
(function canvasPlotterMapCheck() {
  let fake = {
    bipolar: true,
    getRange() {
      return 1;
    },
  };
  let m = CanvasPlotter.prototype.mapInput;
  let ok =
    m.call(fake, -1) === 0 &&
    m.call(fake, 1) === 1 &&
    Math.abs(m.call(fake, 0) - 0.5) < 1e-9 &&
    m.call(fake, 2) === 1 &&
    m.call(fake, -2) === 0;
  fake.bipolar = false;
  ok =
    ok &&
    m.call(fake, 0) === 0 &&
    m.call(fake, 1) === 1 &&
    m.call(fake, -0.5) === 0;
  if (!ok) console.error("CanvasPlotter mapInput self-check failed");
})();
