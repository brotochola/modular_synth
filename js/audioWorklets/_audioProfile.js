// Shared audio-thread profiler. Loaded before other worklets via App.loadWorklet.
// AudioWorkletGlobalScope may lack performance (Firefox / older engines).
function profileNow() {
  // Bracket access — bare `performance` throws ReferenceError in some worklet scopes.
  let p = globalThis["performance"];
  if (p && typeof p.now === "function") return p.now();
  return Date.now();
}

const AudioProfile = {
  _by: Object.create(null),
  _attached: new WeakSet(),
  _totalMs: 0,
  _maxMs: 0,
  _windowStart: 0,

  attach(processor, name) {
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

  // nowMs: prefer audio-clock ms from reporter (always available).
  snapshot(nowMs) {
    let now = nowMs != null ? nowMs : profileNow();
    if (!this._windowStart) this._windowStart = now;
    let windowMs = Math.max(1, now - this._windowStart);
    let quantumMs = (128 / sampleRate) * 1000;
    let quanta = Math.max(1, windowMs / quantumMs);
    let by = Object.create(null);
    for (let name in this._by) {
      let s = this._by[name];
      by[name] = {
        avg: s.n ? s.sum / s.n : 0,
        max: s.max,
        n: s.n,
      };
    }
    let out = {
      windowMs,
      quantumMs,
      totalMs: this._totalMs,
      maxMs: this._maxMs,
      avgMsPerQuantum: this._totalMs / quanta,
      by,
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
  constructor() {
    super();
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
    // Window from audio clock — no performance dependency.
    let snap = AudioProfile.snapshot(currentTime * 1000);
    this.port.postMessage({
      quantumMs: snap.quantumMs,
      totalMs: snap.totalMs,
      maxMs: snap.maxMs,
      windowMs: snap.windowMs,
      avgMsPerQuantum: snap.avgMsPerQuantum,
      late: this._late,
      lateCount: this._lateCount,
      lateMaxMs: this._lateMaxMs,
      hires: !!(globalThis["performance"] && globalThis["performance"].now),
      by: snap.by,
    });
    this._late = false;
    this._lateCount = 0;
    this._lateMaxMs = 0;
    return true;
  }
}

registerProcessor("audio-profile-reporter", AudioProfileReporter);

// ponytail: profiler self-check. Upgrade = AudioWorklet integration test.
(function audioProfileSelfCheck() {
  let fake = {
    process() {
      return true;
    },
  };
  AudioProfile.attach(fake, "_selfcheck");
  let wrapped = fake.process;
  AudioProfile.attach(fake, "_selfcheck");
  if (fake.process !== wrapped) {
    console.error("AudioProfile.attach double-wrap self-check failed");
  }
  let q = (128 / sampleRate) * 1000;
  if (!(q > 0.5 && q < 20)) {
    console.error("AudioProfile quantumMs self-check failed", q);
  }
})();
