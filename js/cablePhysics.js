class CableWorld {
  static MAX_CABLES = 96;
  static BEADS = 14;

  constructor() {
    let max = CableWorld.MAX_CABLES;
    let beads = CableWorld.BEADS;
    this.maxCables = max;
    this.beads = beads;
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

    this.gravity = 1800;
    this.stiffness = 400;
    this.damping = 0.92;
    this.slack = 1.25;
    this.beadRadius = 3.5;
  }

  setParams(p) {
    if (!p) return;
    let prevSlack = this.slack;
    if (p.gravity != null) this.gravity = p.gravity;
    if (p.stiffness != null) this.stiffness = p.stiffness;
    if (p.damping != null) this.damping = p.damping;
    if (p.slack != null) this.slack = p.slack;
    if (p.beadRadius != null) this.beadRadius = p.beadRadius;
    if (this.slack !== prevSlack) {
      for (let slot = 0; slot < this.maxCables; slot++) {
        if (this.cables[slot]) this.rebuildRest(slot);
      }
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
    return slot * this.beads;
  }

  restStart(slot) {
    return slot * (this.beads - 1);
  }

  spawnBetween(slot, x0, y0, x1, y1) {
    let n = this.beads;
    let s = this.beadStart(slot);
    let dx = x1 - x0;
    let dy = y1 - y0;
    let dist = Math.hypot(dx, dy) || 1;
    let midX = (x0 + x1) * 0.5;
    let midY = (y0 + y1) * 0.5 + Math.min(80, dist * 0.25);

    for (let i = 0; i < n; i++) {
      let t = i / (n - 1);
      // quadratic sag through mid
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
    let n = this.beads;
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
      color: opts.color || "#c44",
      fromEl: opts.fromEl || null,
      toEl: opts.toEl || null,
      toMouse: !!opts.toMouse,
      connectionId: opts.connectionId != null ? opts.connectionId : null,
    };
    if (opts.connectionId != null) {
      this.byConnectionId.set(opts.connectionId, slot);
    }
    this.spawnBetween(slot, x0, y0, x1, y1);
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
    let s = this.beadStart(slot);
    let last = s + this.beads - 1;
    this.x[s] = x0;
    this.y[s] = y0;
    this.vx[s] = 0;
    this.vy[s] = 0;
    this.x[last] = x1;
    this.y[last] = y1;
    this.vx[last] = 0;
    this.vy[last] = 0;

    if (rebuildRestIfStretched) {
      let span = Math.hypot(x1 - x0, y1 - y0) || 1;
      let rs = this.restStart(slot);
      let restSum = 0;
      for (let i = 0; i < this.beads - 1; i++) restSum += this.rest[rs + i];
      let target = span * this.slack;
      // grow rest if jacks pulled far; shrink slowly toward target if closer
      if (restSum < target * 0.98 || restSum > target * 1.35) {
        let scale = restSum > 0 ? target / restSum : 1;
        for (let i = 0; i < this.beads - 1; i++) {
          this.rest[rs + i] = Math.max(2, this.rest[rs + i] * scale);
        }
      }
    }
  }

  step(dt) {
    if (dt <= 0) return;
    if (dt > 0.033) dt = 0.033;
    let g = this.gravity;
    let k = this.stiffness;
    let damp = this.damping;
    let n = this.beads;
    let x = this.x;
    let y = this.y;
    let vx = this.vx;
    let vy = this.vy;
    let rest = this.rest;

    for (let slot = 0; slot < this.maxCables; slot++) {
      let cab = this.cables[slot];
      if (!cab) continue;
      let s = this.beadStart(slot);
      let rs = this.restStart(slot);
      let last = s + n - 1;

      // pin ends (caller may have set positions already)
      vx[s] = 0;
      vy[s] = 0;
      vx[last] = 0;
      vy[last] = 0;

      // spring forces on free beads
      for (let i = 1; i < n - 1; i++) {
        let idx = s + i;
        let ax = 0;
        let ay = g;
        // spring to prev
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
        // spring to next
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

      // distance projection (Jakobsen), ends pinned
      for (let pass = 0; pass < 2; pass++) {
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
        // re-assert pins after projection
        // (endpoints already correct from setEndpoints)
      }
    }
  }

  draw(ctx) {
    let r = this.beadRadius;
    let n = this.beads;
    let x = this.x;
    let y = this.y;
    let lineW = Math.max(1.5, r * 2);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let slot = 0; slot < this.maxCables; slot++) {
      let cab = this.cables[slot];
      if (!cab) continue;
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
  }
}
