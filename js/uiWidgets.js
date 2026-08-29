/**
 * Shared UI widgets for rack modules (knob, slider, LED).
 * Global helpers: createKnob, createSlider, createLed, setLed, flashLed
 */

function _clamp(v, min, max) {
  if (min != null && v < min) return min;
  if (max != null && v > max) return max;
  return v;
}

function _formatKnobValue(v) {
  if (!Number.isFinite(v)) return "0";
  let a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 10) return v.toFixed(2);
  return v.toFixed(3).replace(/\.?0+$/, "") || "0";
}

function createKnob(opts) {
  let min = opts.min != null ? opts.min : 0;
  let max = opts.max != null ? opts.max : 1;
  let step = opts.step != null ? opts.step : 0.01;
  let log = !!opts.log;
  let value = _clamp(Number(opts.value) || 0, min, max);
  let onChange = opts.onChange || (() => {});

  let root = document.createElement("div");
  root.className = "ui-knob";
  if (opts.label) root.title = opts.label;

  let dial = document.createElement("div");
  dial.className = "ui-knob-dial";
  let pointer = document.createElement("div");
  pointer.className = "ui-knob-pointer";
  dial.appendChild(pointer);

  let field = document.createElement("input");
  field.type = "number";
  field.className = "ui-knob-value";
  if (min != null) field.min = min;
  if (max != null) field.max = max;
  field.step = step;

  root.appendChild(dial);
  root.appendChild(field);

  function toNorm(v) {
    v = _clamp(v, min, max);
    if (!log || min <= 0) {
      return max === min ? 0 : (v - min) / (max - min);
    }
    let lo = Math.log(Math.max(min, 1e-6));
    let hi = Math.log(Math.max(max, 1e-6));
    return (Math.log(Math.max(v, 1e-6)) - lo) / (hi - lo);
  }

  function fromNorm(n) {
    n = _clamp(n, 0, 1);
    let v;
    if (!log || min <= 0) {
      v = min + n * (max - min);
    } else {
      let lo = Math.log(Math.max(min, 1e-6));
      let hi = Math.log(Math.max(max, 1e-6));
      v = Math.exp(lo + n * (hi - lo));
    }
    if (step > 0) v = Math.round(v / step) * step;
    return _clamp(v, min, max);
  }

  function paint() {
    let n = toNorm(value);
    let deg = -135 + n * 270;
    dial.style.setProperty("--angle", deg + "deg");
    field.value = _formatKnobValue(value);
  }

  function setValue(v, silent) {
    value = _clamp(Number(v) || 0, min, max);
    paint();
    if (!silent) onChange(value);
  }

  let dragY = 0;
  let dragNorm = 0;
  dial.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dial.setPointerCapture(e.pointerId);
    dragY = e.clientY;
    dragNorm = toNorm(value);
  });
  dial.addEventListener("pointermove", (e) => {
    if (!dial.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    e.stopPropagation();
    let dy = dragY - e.clientY;
    setValue(fromNorm(dragNorm + dy / 120));
  });
  dial.addEventListener("pointerup", (e) => {
    if (dial.hasPointerCapture(e.pointerId)) {
      dial.releasePointerCapture(e.pointerId);
    }
  });
  dial.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    let delta = e.deltaY > 0 ? -step : step;
    if (log && Math.abs(value) > 1) delta *= Math.max(1, value * 0.02);
    setValue(value + delta);
  }, { passive: false });

  field.addEventListener("keydown", (e) => e.stopImmediatePropagation());
  field.addEventListener("pointerdown", (e) => e.stopPropagation());
  field.addEventListener("change", () => setValue(Number(field.value)));
  field.addEventListener("blur", () => setValue(Number(field.value)));

  paint();
  return {
    el: root,
    dial,
    field,
    getValue: () => value,
    setValue: (v) => setValue(v, true),
    setValueNotify: (v) => setValue(v, false),
  };
}

function createSlider(opts) {
  let min = opts.min != null ? opts.min : 0;
  let max = opts.max != null ? opts.max : 1;
  let step = opts.step != null ? opts.step : 0.01;
  let value = _clamp(Number(opts.value) || 0, min, max);
  let onChange = opts.onChange || (() => {});

  let root = document.createElement("label");
  root.className = "ui-slider" + (opts.vertical ? " ui-slider-vertical" : "");

  let range = document.createElement("input");
  range.type = "range";
  range.min = min;
  range.max = max;
  range.step = step;
  range.value = value;
  range.oninput = () => {
    value = Number(range.value);
    onChange(value);
  };
  range.onpointerdown = (e) => e.stopPropagation();

  root.appendChild(range);
  if (opts.label) {
    let cap = document.createElement("span");
    cap.className = "ui-slider-label";
    cap.textContent = opts.label;
    root.appendChild(cap);
  }

  return {
    el: root,
    range,
    getValue: () => value,
    setValue: (v) => {
      value = _clamp(Number(v) || 0, min, max);
      range.value = value;
    },
  };
}

function createLed(opts) {
  let el = document.createElement("span");
  el.className = "ui-led";
  if (opts && opts.color) el.style.setProperty("--led-color", opts.color);
  if (opts && opts.on) el.classList.add("on");
  return el;
}

function setLed(el, on) {
  if (!el) return;
  el.classList.toggle("on", !!on);
}

/** Bipolar jack LED: v in [-1,1]; + green, − red, ~0 off. Colors via inline style. */
function setLedBipolar(el, v) {
  if (!el) return;
  v = Number(v) || 0;
  if (v > 1) v = 1;
  else if (v < -1) v = -1;
  let a = v < 0 ? -v : v;
  if (a < 0.02) {
    el.style.background = "";
    el.style.borderColor = "";
    el.style.boxShadow = "";
    el.classList.remove("on", "pulse");
    return;
  }
  let r, g, b;
  if (v >= 0) {
    r = Math.round(40 * a);
    g = Math.round(180 * a + 40);
    b = Math.round(80 * a);
  } else {
    r = Math.round(200 * a + 40);
    g = Math.round(40 * a);
    b = Math.round(40 * a);
  }
  let col = "rgb(" + r + "," + g + "," + b + ")";
  let glow = Math.round(4 + 10 * a);
  el.style.background = col;
  el.style.borderColor = col;
  el.style.boxShadow =
    "0 0 " + glow + "px " + col + ", 0 0 2px rgba(255,255,255,0.4)";
  el.classList.remove("pulse");
}

function flashLed(el, ms) {
  if (!el) return;
  el.classList.add("on", "pulse");
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => {
    el.classList.remove("on", "pulse");
  }, ms != null ? ms : AppConfig.LED_FLASH_MS);
}

/** Strong green flash for trig jacks (rising edge). Clears inline bipolar styles. */
function flashLedTrig(el, ms) {
  if (!el) return;
  el.style.background = "rgb(40,220,80)";
  el.style.borderColor = "rgb(40,220,80)";
  el.style.boxShadow =
    "0 0 14px rgb(40,220,80), 0 0 3px #fff";
  el.classList.remove("pulse");
  clearTimeout(el._flashTrigTimer);
  el._flashTrigTimer = setTimeout(() => {
    el.style.background = "";
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }, ms != null ? ms : AppConfig.LED_FLASH_MS);
}
