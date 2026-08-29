// Shared audio-thread profiler. Loaded after config + _sab.
let _nowFn = null;
function profileNow() {
  if (!_nowFn) {
    let p = globalThis["performance"];
    if (p && typeof p.now === "function") _nowFn = p.now.bind(p);
    else _nowFn = Date.now;
  }
  return _nowFn();
}

const AudioProfile = {
  _by: Object.create(null),
  _attached: new WeakSet(),
  _totalMs: 0,
  _maxMs: 0,
  _windowStart: 0,

  attach(processor, name) {
    if (globalThis.AppConfig && !AppConfig.AUDIO_PROFILE_WRAP) return;
    if (!processor || typeof name !== "string" || !name) return;
    if (this._attached.has(processor)) return;
    let orig = processor.process;
    if (typeof orig !== "function") return;
    this._attached.add(processor);
    let self = this;
    processor.process = function (inputs, outputs, parameters) {
      let t0 = profileNow();
      let ret;
      try {
        ret = orig.call(this, inputs, outputs, parameters);
      } finally {
        self._record(name, profileNow() - t0);
      }
      return ret;
    };
  },

  _record(name, ms) {
    this._totalMs += ms;
    if (ms > this._maxMs) this._maxMs = ms;
    let s = this._by[name];
    if (!s) {
      s = { sum: 0, max: 0, n: 0 };
      this._by[name] = s;
    }
    s.sum += ms;
    s.n++;
    if (ms > s.max) s.max = ms;
  },

  snapshot(nowMs) {
    let now = nowMs != null ? nowMs : profileNow();
    if (!this._windowStart) this._windowStart = now;
    let windowMs = Math.max(1, now - this._windowStart);
    let quantumMs = (128 / sampleRate) * 1000;
    let quanta = Math.max(1, windowMs / quantumMs);
    let out = {
      windowMs,
      quantumMs,
      totalMs: this._totalMs,
      maxMs: this._maxMs,
      avgMsPerQuantum: this._totalMs / quanta,
    };
    this._by = Object.create(null);
    this._totalMs = 0;
    this._maxMs = 0;
    this._windowStart = now;
    return out;
  },
};

globalThis.AudioProfile = AudioProfile;

class AudioProfileReporter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    this._lastPost = currentTime;
    this._lastCb = currentTime;
    this._late = false;
    this._lateCount = 0;
    this._lateMaxMs = 0;
    this._inited = false;
  }

  process() {
    let expected = 128 / sampleRate;
    let dt = currentTime - this._lastCb;
    this._lastCb = currentTime;
    if (this._inited && dt > expected * 1.5 && dt < 0.1) {
      this._late = true;
      this._lateCount++;
      let excessMs = (dt - expected) * 1000;
      if (excessMs > this._lateMaxMs) this._lateMaxMs = excessMs;
    }
    this._inited = true;

    if (currentTime - this._lastPost < 0.25) return true;
    this._lastPost = currentTime;
    let snap = AudioProfile.snapshot(currentTime * 1000);
    let sab = this.sab;
    if (sab) {
      sab.setSlot(0, snap.quantumMs);
      sab.setSlot(1, snap.totalMs);
      sab.setSlot(2, snap.maxMs);
      sab.setSlot(3, snap.windowMs);
      sab.setSlot(4, snap.avgMsPerQuantum);
      sab.setSlot(5, this._late ? 1 : 0);
      sab.setSlot(6, this._lateCount);
      sab.setSlot(7, this._lateMaxMs);
      sab.publish();
    }
    this._late = false;
    this._lateCount = 0;
    this._lateMaxMs = 0;
    return true;
  }
}

registerProcessor("audio-profile-reporter", AudioProfileReporter);
