class CableWorld {
  static MAX_CABLES = 96;
  static MAX_BEADS = 36;
  static MIN_BEADS = 6;

  constructor() {
    let max = CableWorld.MAX_CABLES;
    let beads = CableWorld.MAX_BEADS;
    this.maxCables = max;
    this.maxBeads = beads;
    this.minBeads = CableWorld.MIN_BEADS;
    this.capacity = max * beads;

    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.vx = new Float32Array(this.capacity);
    this.vy = new Float32Array(this.capacity);
    this.rest = new Float32Array(max * (beads - 1));

    this.cables = new Array(max);
    this.freeList = [];
    for (let i = max - 1; i >= 0; i--) this.freeList.push(i);

    this.byConnectionId = new Map();
    this.ghostSlot = -1;

    this.gravity = 4000;
    this.stiffness = 0;
    this.damping = 0.88;
    this.slack = 0.5;
    this.beadRadius = 1.25;
    this.cableAlpha = 0.5;
    this.awake = true;
    this.settledFrames = 0;
  }

  static SETTLE_FRAMES = 10;
  static VEL_EPS = 4;

  wake() {
    this.awake = true;
    this.settledFrames = 0;
  }

  static beadCountForDist(dist) {
    let n = Math.round(dist / 36) + 4;
    if (n < CableWorld.MIN_BEADS) n = CableWorld.MIN_BEADS;
    if (n > CableWorld.MAX_BEADS) n = CableWorld.MAX_BEADS;
    return n;
  }

  setParams(p) {
    if (!p) return;
    let prevSlack = this.slack;
    if (p.gravity != null) this.gravity = p.gravity;
    if (p.stiffness != null) this.stiffness = p.stiffness;
    if (p.damping != null) this.damping = p.damping;
    if (p.slack != null) this.slack = p.slack;
    if (p.beadRadius != null) this.beadRadius = p.beadRadius;
    if (p.cableAlpha != null) this.cableAlpha = p.cableAlpha;
    if (this.slack !== prevSlack) {
      for (let slot = 0; slot < this.maxCables; slot++) {
        if (this.cables[slot]) this.rebuildRest(slot);
      }
      this.wake();
    }
  }

  allocSlot() {
    if (!this.freeList.length) return -1;
    return this.freeList.pop();
  }

  freeSlot(slot) {
    if (slot < 0 || slot >= this.maxCables) return;
    let cab = this.cables[slot];
    if (!cab) return;
    if (cab.connectionId != null) this.byConnectionId.delete(cab.connectionId);
    this.cables[slot] = null;
    this.freeList.push(slot);
    if (this.ghostSlot == slot) this.ghostSlot = -1;
  }

  beadStart(slot) {
    return slot * this.maxBeads;
  }

  restStart(slot) {
    return slot * (this.maxBeads - 1);
  }

  spawnBetween(slot, x0, y0, x1, y1, count) {
    let cab = this.cables[slot];
    let dist = Math.hypot(x1 - x0, y1 - y0) || 1;
    let n = count != null ? count : CableWorld.beadCountForDist(dist);
    if (n < this.minBeads) n = this.minBeads;
    if (n > this.maxBeads) n = this.maxBeads;
    if (cab) cab.count = n;

    let s = this.beadStart(slot);
    let midX = (x0 + x1) * 0.5;
    let midY = (y0 + y1) * 0.5 + Math.min(80, dist * 0.25);

    for (let i = 0; i < n; i++) {
      let t = i / (n - 1);
      let omt = 1 - t;
      let px = omt * omt * x0 + 2 * omt * t * midX + t * t * x1;
      let py = omt * omt * y0 + 2 * omt * t * midY + t * t * y1;
      let idx = s + i;
      this.x[idx] = px;
      this.y[idx] = py;
      this.vx[idx] = 0;
      this.vy[idx] = 0;
    }

    this.rebuildRest(slot);
  }

  rebuildRest(slot) {
    let cab = this.cables[slot];
    if (!cab) return;
    let n = cab.count || this.minBeads;
    let s = this.beadStart(slot);
    let rs = this.restStart(slot);
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
      let a = s + i;
      let b = a + 1;
      total += Math.hypot(this.x[b] - this.x[a], this.y[b] - this.y[a]);
    }
    let x0 = this.x[s];
    let y0 = this.y[s];
    let x1 = this.x[s + n - 1];
    let y1 = this.y[s + n - 1];
    let span = Math.hypot(x1 - x0, y1 - y0) || 1;
    let target = span * this.slack;
    let scale = total > 0 ? target / total : 1;
    for (let i = 0; i < n - 1; i++) {
      let a = s + i;
      let b = a + 1;
      let seg = Math.hypot(this.x[b] - this.x[a], this.y[b] - this.y[a]);
      this.rest[rs + i] = Math.max(2, seg * scale);
    }
  }

  createCable(opts) {
    let slot = this.allocSlot();
    if (slot < 0) return -1;
    let x0 = opts.x0;
    let y0 = opts.y0;
    let x1 = opts.x1;
    let y1 = opts.y1;
    this.cables[slot] = {
      slot,
      count: this.minBeads,
      culled: false,
      color: opts.color || "#c44",
      fromEl: opts.fromEl || null,
      toEl: opts.toEl || null,
      toMouse: !!opts.toMouse,
      connectionId: opts.connectionId != null ? opts.connectionId : null,
      pinX0: x0,
      pinY0: y0,
      pinX1: x1,
      pinY1: y1,
    };
    if (opts.connectionId != null) {
      this.byConnectionId.set(opts.connectionId, slot);
    }
    this.spawnBetween(slot, x0, y0, x1, y1);
    this.wake();
    return slot;
  }

  freeCable(slot) {
    this.freeSlot(slot);
  }

  freeByConnectionId(connectionId) {
    let slot = this.byConnectionId.get(connectionId);
    if (slot == null) return;
    this.freeSlot(slot);
  }

  ensureGhost(fromEl, x0, y0, x1, y1) {
    if (this.ghostSlot >= 0 && this.cables[this.ghostSlot]) {
      let cab = this.cables[this.ghostSlot];
      cab.fromEl = fromEl;
      cab.toMouse = true;
      cab.toEl = null;
      cab.culled = false;
      cab.color = "rgba(200,220,255,0.85)";
      this.setEndpoints(this.ghostSlot, x0, y0, x1, y1, false);
      return this.ghostSlot;
    }
    this.ghostSlot = this.createCable({
      x0,
      y0,
      x1,
      y1,
      fromEl,
      toMouse: true,
      color: "rgba(200,220,255,0.85)",
    });
    if (this.ghostSlot >= 0) this.cables[this.ghostSlot].culled = false;
    return this.ghostSlot;
  }

  clearGhost() {
    if (this.ghostSlot >= 0) {
      this.freeSlot(this.ghostSlot);
      this.ghostSlot = -1;
    }
  }

  setEndpoints(slot, x0, y0, x1, y1, rebuildRestIfStretched) {
    let cab = this.cables[slot];
    if (!cab) return;

    let oldX0 = cab.pinX0;
    let oldY0 = cab.pinY0;
    let oldX1 = cab.pinX1;
    let oldY1 = cab.pinY1;

    cab.pinX0 = x0;
    cab.pinY0 = y0;
    cab.pinX1 = x1;
    cab.pinY1 = y1;

    if (
      Math.abs(x0 - oldX0) > 0.01 ||
      Math.abs(y0 - oldY0) > 0.01 ||
      Math.abs(x1 - oldX1) > 0.01 ||
      Math.abs(y1 - oldY1) > 0.01
    ) {
      this.wake();
    }

    let dist = Math.hypot(x1 - x0, y1 - y0) || 1;
    let want = CableWorld.beadCountForDist(dist);

    if (!cab.count) {
      this.spawnBetween(slot, x0, y0, x1, y1, want);
      return;
    }

    if (want != cab.count) {
      let d0 = Math.hypot(x0 - oldX0, y0 - oldY0);
      let d1 = Math.hypot(x1 - oldX1, y1 - oldY1);
      let moveEnd = d1 >= d0 ? 1 : 0;
      this.resizeCount(slot, want, moveEnd);
    }

    let n = cab.count;
    let s = this.beadStart(slot);
    let last = s + n - 1;
    this.x[s] = x0;
    this.y[s] = y0;
    this.vx[s] = 0;
    this.vy[s] = 0;
    this.x[last] = x1;
    this.y[last] = y1;
    this.vx[last] = 0;
    this.vy[last] = 0;

    if (rebuildRestIfStretched) {
      let span = dist;
      let rs = this.restStart(slot);
      let restSum = 0;
      for (let i = 0; i < n - 1; i++) restSum += this.rest[rs + i];
      let target = span * this.slack;
      if (restSum < target * 0.98 || restSum > target * 1.35) {
        let scale = restSum > 0 ? target / restSum : 1;
        for (let i = 0; i < n - 1; i++) {
          this.rest[rs + i] = Math.max(2, this.rest[rs + i] * scale);
        }
      }
    }
  }

  // Grow/shrink at the end that moved; new beads copy the neighbor near that pin.
  resizeCount(slot, want, moveEnd) {
    let cab = this.cables[slot];
    if (!cab) return;
    if (want < this.minBeads) want = this.minBeads;
    if (want > this.maxBeads) want = this.maxBeads;
    let n = cab.count || this.minBeads;
    if (want == n) return;

    let s = this.beadStart(slot);
    let x = this.x;
    let y = this.y;
    let vx = this.vx;
    let vy = this.vy;

    if (want > n) {
      let add = want - n;
      if (moveEnd == 1) {
        let src = s + Math.max(0, n - 2);
        let sx = x[src];
        let sy = y[src];
        let svx = vx[src];
        let svy = vy[src];
        let pinX = x[s + n - 1];
        let pinY = y[s + n - 1];
        let pvx = vx[s + n - 1];
        let pvy = vy[s + n - 1];
        for (let i = 0; i < add; i++) {
          let idx = s + n - 1 + i;
          x[idx] = sx;
          y[idx] = sy;
          vx[idx] = svx;
          vy[idx] = svy;
        }
        x[s + want - 1] = pinX;
        y[s + want - 1] = pinY;
        vx[s + want - 1] = pvx;
        vy[s + want - 1] = pvy;
      } else {
        let src = s + Math.min(1, n - 1);
        let sx = x[src];
        let sy = y[src];
        let svx = vx[src];
        let svy = vy[src];
        for (let i = n - 1; i >= 1; i--) {
          let from = s + i;
          let to = s + i + add;
          x[to] = x[from];
          y[to] = y[from];
          vx[to] = vx[from];
          vy[to] = vy[from];
        }
        for (let i = 1; i <= add; i++) {
          let idx = s + i;
          x[idx] = sx;
          y[idx] = sy;
          vx[idx] = svx;
          vy[idx] = svy;
        }
      }
    } else {
      let rem = n - want;
      if (moveEnd == 1) {
        let pinX = x[s + n - 1];
        let pinY = y[s + n - 1];
        let pvx = vx[s + n - 1];
        let pvy = vy[s + n - 1];
        x[s + want - 1] = pinX;
        y[s + want - 1] = pinY;
        vx[s + want - 1] = pvx;
        vy[s + want - 1] = pvy;
      } else {
        for (let i = 1; i < want; i++) {
          let from = s + i + rem;
          let to = s + i;
          x[to] = x[from];
          y[to] = y[from];
          vx[to] = vx[from];
          vy[to] = vy[from];
        }
      }
    }

    cab.count = want;
    this.rebuildRest(slot);
  }

  updateCullFlags(worldL, worldT, worldR, worldB) {
    for (let slot = 0; slot < this.maxCables; slot++) {
      let cab = this.cables[slot];
      if (!cab) continue;
      if (cab.toMouse || slot == this.ghostSlot) {
        cab.culled = false;
        continue;
      }
      let x0 = cab.pinX0;
      let y0 = cab.pinY0;
      let x1 = cab.pinX1;
      let y1 = cab.pinY1;
      let dist = Math.hypot(x1 - x0, y1 - y0) || 1;
      let pad = this.slack * dist * 0.35 + 80;
      let minX = Math.min(x0, x1) - pad;
      let maxX = Math.max(x0, x1) + pad;
      let minY = Math.min(y0, y1) - pad;
      let maxY = Math.max(y0, y1) + pad;
      cab.culled =
        maxX < worldL || minX > worldR || maxY < worldT || minY > worldB;
    }
  }

  stepCable(slot, dt, g, k, damp, x, y, vx, vy, rest) {
    let cab = this.cables[slot];
    if (!cab || cab.culled) return;
    let n = cab.count || this.minBeads;
    let s = this.beadStart(slot);
    let rs = this.restStart(slot);
    let last = s + n - 1;

    vx[s] = 0;
    vy[s] = 0;
    vx[last] = 0;
    vy[last] = 0;

    for (let i = 1; i < n - 1; i++) {
      let idx = s + i;
      let ax = 0;
      let ay = g;
      {
        let a = idx - 1;
        let b = idx;
        let dx = x[b] - x[a];
        let dy = y[b] - y[a];
        let dist = Math.hypot(dx, dy) || 0.0001;
        let f = (k * (dist - rest[rs + i - 1])) / dist;
        ax -= f * dx;
        ay -= f * dy;
      }
      {
        let a = idx;
        let b = idx + 1;
        let dx = x[b] - x[a];
        let dy = y[b] - y[a];
        let dist = Math.hypot(dx, dy) || 0.0001;
        let f = (k * (dist - rest[rs + i])) / dist;
        ax += f * dx;
        ay += f * dy;
      }
      vx[idx] = (vx[idx] + ax * dt) * damp;
      vy[idx] = (vy[idx] + ay * dt) * damp;
      x[idx] += vx[idx] * dt;
      y[idx] += vy[idx] * dt;
    }

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n - 1; i++) {
        let a = s + i;
        let b = a + 1;
        let dx = x[b] - x[a];
        let dy = y[b] - y[a];
        let dist = Math.hypot(dx, dy) || 0.0001;
        let diff = (dist - rest[rs + i]) / dist;
        let pinA = i == 0;
        let pinB = i == n - 2;
        if (pinA && pinB) continue;
        if (pinA) {
          x[b] -= dx * diff;
          y[b] -= dy * diff;
        } else if (pinB) {
          x[a] += dx * diff;
          y[a] += dy * diff;
        } else {
          let hx = dx * diff * 0.5;
          let hy = dy * diff * 0.5;
          x[a] += hx;
          y[a] += hy;
          x[b] -= hx;
          y[b] -= hy;
        }
      }
      // re-pin ends after projection
      x[s] = cab.pinX0;
      y[s] = cab.pinY0;
      x[last] = cab.pinX1;
      y[last] = cab.pinY1;
    }
  }

  maxBeadSpeedSq() {
    let maxSq = 0;
    let vx = this.vx;
    let vy = this.vy;
    for (let slot = 0; slot < this.maxCables; slot++) {
      let cab = this.cables[slot];
      if (!cab || cab.culled) continue;
      let n = cab.count || this.minBeads;
      let s = this.beadStart(slot);
      for (let i = 1; i < n - 1; i++) {
        let idx = s + i;
        let sp = vx[idx] * vx[idx] + vy[idx] * vy[idx];
        if (sp > maxSq) maxSq = sp;
      }
    }
    return maxSq;
  }

  step(dt) {
    if (!this.awake) return false;
    if (dt <= 0) return true;
    if (dt > 0.033) dt = 0.033;
    let sub = dt * 0.5;
    let g = this.gravity;
    let k = this.stiffness;
    let damp = this.damping;
    let x = this.x;
    let y = this.y;
    let vx = this.vx;
    let vy = this.vy;
    let rest = this.rest;

    for (let substep = 0; substep < 2; substep++) {
      for (let slot = 0; slot < this.maxCables; slot++) {
        this.stepCable(slot, sub, g, k, damp, x, y, vx, vy, rest);
      }
    }

    let eps = CableWorld.VEL_EPS;
    if (this.ghostSlot < 0 && this.maxBeadSpeedSq() < eps * eps) {
      this.settledFrames++;
      if (this.settledFrames >= CableWorld.SETTLE_FRAMES) this.awake = false;
    } else {
      this.settledFrames = 0;
    }
    return true;
  }

  draw(ctx) {
    let r = this.beadRadius;
    let x = this.x;
    let y = this.y;
    let lineW = Math.max(1.5, r * 2);
    let prevAlpha = ctx.globalAlpha;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = prevAlpha * this.cableAlpha;

    for (let slot = 0; slot < this.maxCables; slot++) {
      let cab = this.cables[slot];
      if (!cab || cab.culled) continue;
      let n = cab.count || this.minBeads;
      let s = this.beadStart(slot);

      ctx.beginPath();
      ctx.strokeStyle = cab.color;
      ctx.lineWidth = lineW;
      ctx.moveTo(x[s], y[s]);
      for (let i = 1; i < n; i++) {
        ctx.lineTo(x[s + i], y[s + i]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = prevAlpha;
  }
}
