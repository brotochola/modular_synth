/* global CableWorld */
importScripts("cablePhysics.js");

let canvas = null;
let ctx = null;
let world = null;
let paused = false;
let width = 0;
let height = 0;

function ensureWorld() {
  if (!world) world = new CableWorld();
  return world;
}

function applySync(msg) {
  let w = ensureWorld();
  if (msg.params) w.setParams(msg.params);

  if (msg.full && msg.removeIds) {
    for (let id of msg.removeIds) w.freeByConnectionId(id);
  } else if (msg.full) {
    let live = new Set((msg.cables || []).map((c) => c.id));
    for (let [connId] of [...w.byConnectionId.entries()]) {
      if (!live.has(connId)) w.freeByConnectionId(connId);
    }
  } else if (msg.removeIds) {
    for (let id of msg.removeIds) w.freeByConnectionId(id);
  }

  for (let c of msg.cables || []) {
    let slot = w.byConnectionId.get(c.id);
    if (slot == null) {
      w.createCable({
        x0: c.x0,
        y0: c.y0,
        x1: c.x1,
        y1: c.y1,
        connectionId: c.id,
        color: c.color,
      });
    } else {
      let cab = w.cables[slot];
      if (cab) cab.color = c.color;
      w.setEndpoints(slot, c.x0, c.y0, c.x1, c.y1, true);
    }
  }

  if (msg.ghost === null) {
    w.clearGhost();
  } else if (msg.ghost) {
    let g = msg.ghost;
    w.ensureGhost(null, g.x0, g.y0, g.x1, g.y1);
    if (w.ghostSlot >= 0) {
      w.setEndpoints(w.ghostSlot, g.x0, g.y0, g.x1, g.y1, true);
    }
  }

  if (msg.wake) w.wake();
}

function paint(view) {
  if (!ctx || !canvas || !world || paused) return;
  let s = view.scale || 1;
  let ox = view.ox || 0;
  let oy = view.oy || 0;
  world.updateCullFlags(view.worldL, view.worldT, view.worldR, view.worldB);
  world.step(view.dt || 0.016);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(s, 0, 0, s, ox, oy);
  world.draw(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

self.onmessage = (e) => {
  let msg = e.data || {};
  switch (msg.type) {
    case "init": {
      canvas = msg.canvas;
      width = msg.width || canvas.width;
      height = msg.height || canvas.height;
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineWidth = 3;
      ensureWorld();
      if (msg.params) world.setParams(msg.params);
      break;
    }
    case "resize": {
      if (!canvas) break;
      width = msg.width;
      height = msg.height;
      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
      break;
    }
    case "params": {
      ensureWorld().setParams(msg.params);
      break;
    }
    case "sync": {
      applySync(msg);
      break;
    }
    case "view": {
      paint(msg);
      break;
    }
    case "wake": {
      ensureWorld().wake();
      break;
    }
    case "pause": {
      paused = true;
      break;
    }
    case "resume": {
      paused = false;
      ensureWorld().wake();
      break;
    }
  }
};
