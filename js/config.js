/**
 * Global app config — main thread (script tag) and AudioWorklet scope (addModule).
 * Worklets: App.loadWorklet loads this before other modules.
 */
(function (root) {
  let AppConfig = {
    // --- Transport ---
    DEFAULT_BPM: 100,
    FALLBACK_BPM: 120,
    SEQ_STEPS: 16,
    /** Fraction of a quarter note per sequencer step (0.25 = 16th). */
    SEQ_STEP_QUARTER: 0.25,
    ONE_SEMITONE: 1.059463,

    // --- Triggers / clocks ---
    /** Standard trig / clock pulse width (seconds). ~10ms. */
    TRIG_PULSE_SEC: 0.01,
    /** Schmitt: fire when CV crosses high; reset when it falls below low. ~1V / 0.5V on a 0–10V rail. */
    TRIG_HIGH: 0.1,
    TRIG_LOW: 0.05,
    /** Alias of TRIG_HIGH for older worklets. */
    TRIG_THRESHOLD: 0.1,
    /** Min delta for sequencer external-clock rising edge. */
    CLOCK_EDGE_DELTA: 0.01,

    // --- Jack activity LEDs ---
    /** Report peak levels every N process() quanta. */
    JACK_ACTIVITY_REPORT_EVERY: 12,

    // --- UI LEDs ---
    LED_FLASH_MS: 100,
    LED_FLASH_BPM_MS: 80,

    // --- 808 Kick ---
    KICK_BANG_MS: 20,
    KICK_PITCH_ENV_SEC: 0.05,
    KICK_CLICK_ENV_SEC: 0.002,

    // --- 808 Perc (snare / clap / hat / cowbell) ---
    SNARE_RATIO: 330 / 185,
    CLAP_PULSE0_SEC: 0,
    CLAP_PULSE1_SEC: 0.01,
    CLAP_PULSE2_SEC: 0.021,
    CLAP_PULSE3_SEC: 0.031,
    CLAP_BURST_SEC: 0.005,
    HAT_CLOSED_SEC: 0.07,
    HAT_FREQS: [205.3, 304.4, 369.6, 522.7, 540, 800],
    COWBELL_RATIO: 800 / 540,
    CYMBAL_BPF_LO: 800,
    CYMBAL_BPF_HI: 5000,
    CYMBAL_HPF: 400,
    RIM_FREQ_LO: 455,
    RIM_FREQ_HI: 1800,
    CLAVE_HZ: 2500,
    TOM_HZ: 140,
    FREEVERB_COMB: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617],
    FREEVERB_ALLPASS: [556, 441, 341, 225],
    FREEVERB_SPREAD: 23,

    // --- Audio profiler ---
    /** Wrap every process() with timing. Off in prod; reporter still tracks xruns. */
    AUDIO_PROFILE_WRAP: false,

    // --- SharedArrayBuffer layout (main + worklet) ---
    SAB_MAGIC: 0x53414231,
    SAB_VERSION: 1,
    SAB_BYTES: 4096,
    SAB_HEADER_INTS: 64,
    SAB_N_SLOTS: 128,
    SAB_N_EVENTS: 256,
    SAB_I_MAGIC: 0,
    SAB_I_VERSION: 1,
    SAB_I_SEQ: 2,
    SAB_I_FLAGS: 3,
    SAB_I_ENDED: 4,
    SAB_I_ERROR: 5,
    SAB_I_EVT_WRITE: 6,
    SAB_I_EVT_READ: 7,
    SAB_I_NOTE: 8,
    SAB_I_BULK_SEQ: 9,
    SAB_I_N_SLOTS: 10,
    SAB_I_N_EVT: 11,
    SAB_I_BPM: 12,
    SAB_I_RATE: 13,
    SAB_I_REC: 14,
    SAB_I_PEAK_N: 15,
    SAB_I_BULK_WRITE: 16,
    SAB_I_BULK_READ: 17,
    SAB_SLOT_BASE: 64,
    SAB_EVT_BASE: 192,
    SAB_RING_BASE: 448,
    SAB_RING_STRIDE: 6,
    SAB_RING_CAP: 90,
    SAB_SLOT_PEAK0: 96,
    SAB_EVT_NOTE: 1,
    SAB_EVT_CC: 2,
    SAB_EVT_PAD: 3,
    SAB_EVT_MOD: 4,
    SAB_EVT_BEND: 5,
    SAB_EVT_KEY: 6,
    SAB_EVT_PARAM: 7,
    SAB_EVT_TRIG: 8,
    SAB_REC_RECORDING: 1,
    SAB_REC_PLAYING: 2,
    SAB_REC_LATCH: 4,
    SAB_BULK_HDR: 64,

    // --- Patch history / cables ---
    HISTORY_CAP: 40,
    CABLE: {
      gravity: 4000,
      stiffness: 0,
      damping: 0.88,
      slack: 0.5,
      beadRadius: 1.25,
      cableAlpha: 0.5,
    },

    pulseSamples(sec, sr) {
      let rate = sr != null ? sr : typeof sampleRate !== "undefined" ? sampleRate : 48000;
      return Math.max(1, Math.floor(rate * sec));
    },

    trigPulseSamples(sr) {
      return this.pulseSamples(this.TRIG_PULSE_SEC, sr);
    },

    isRising(prev, cur) {
      return prev < this.TRIG_HIGH && cur >= this.TRIG_HIGH;
    },

    isFalling(prev, cur) {
      return prev >= this.TRIG_LOW && cur < this.TRIG_LOW;
    },

    /** Schmitt latch. 0/1 in, 0/1 out. Rise = was 0, now 1. */
    schmitt(on, cur) {
      if (!on) return cur >= this.TRIG_HIGH ? 1 : 0;
      return cur < this.TRIG_LOW ? 0 : 1;
    },

    packEvent(type, a, b, c) {
      return (
        (type & 255) |
        ((a & 255) << 8) |
        ((b & 255) << 16) |
        ((c & 255) << 24)
      );
    },

    wrapSab(sab) {
      if (!sab) return null;
      let C = this;
      let i32 = new Int32Array(sab);
      let f32 = new Float32Array(sab);
      if (Atomics.load(i32, C.SAB_I_MAGIC) !== C.SAB_MAGIC) {
        i32[C.SAB_I_MAGIC] = C.SAB_MAGIC;
        i32[C.SAB_I_VERSION] = C.SAB_VERSION;
        i32[C.SAB_I_N_SLOTS] = C.SAB_N_SLOTS;
        i32[C.SAB_I_N_EVT] = C.SAB_N_EVENTS;
      }
      let slot0 = C.SAB_SLOT_BASE;
      let evt0 = C.SAB_EVT_BASE;
      let cap = C.SAB_N_EVENTS;
      return {
        sab: sab,
        i32: i32,
        f32: f32,
        setSlot: function (i, v) {
          f32[slot0 + i] = v;
        },
        getSlot: function (i) {
          return f32[slot0 + i];
        },
        publish: function () {
          Atomics.add(i32, C.SAB_I_SEQ, 1);
        },
        seq: function () {
          return Atomics.load(i32, C.SAB_I_SEQ);
        },
        setNote: function (n) {
          Atomics.store(i32, C.SAB_I_NOTE, n | 0);
        },
        getNote: function () {
          return Atomics.load(i32, C.SAB_I_NOTE);
        },
        setEnded: function (v) {
          Atomics.store(i32, C.SAB_I_ENDED, v ? 1 : 0);
        },
        getEnded: function () {
          return Atomics.load(i32, C.SAB_I_ENDED);
        },
        setError: function (code) {
          Atomics.store(i32, C.SAB_I_ERROR, code | 0);
        },
        getError: function () {
          return Atomics.load(i32, C.SAB_I_ERROR);
        },
        setBpm: function (bpm) {
          Atomics.store(i32, C.SAB_I_BPM, (bpm * 1000) | 0);
        },
        getBpm: function () {
          return Atomics.load(i32, C.SAB_I_BPM) / 1000;
        },
        setRate: function (rate) {
          Atomics.store(i32, C.SAB_I_RATE, (rate * 1000) | 0);
        },
        getRate: function () {
          return Atomics.load(i32, C.SAB_I_RATE) / 1000;
        },
        setRec: function (bits) {
          Atomics.store(i32, C.SAB_I_REC, bits | 0);
        },
        getRec: function () {
          return Atomics.load(i32, C.SAB_I_REC);
        },
        pushEvent: function (packed) {
          let w = Atomics.load(i32, C.SAB_I_EVT_WRITE);
          let r = Atomics.load(i32, C.SAB_I_EVT_READ);
          if (w - r >= cap) return false;
          i32[evt0 + (w & (cap - 1))] = packed;
          Atomics.store(i32, C.SAB_I_EVT_WRITE, w + 1);
          return true;
        },
        pullEvent: function () {
          let w = Atomics.load(i32, C.SAB_I_EVT_WRITE);
          let r = Atomics.load(i32, C.SAB_I_EVT_READ);
          if (r === w) return 0;
          let v = i32[evt0 + (r & (cap - 1))];
          Atomics.store(i32, C.SAB_I_EVT_READ, r + 1);
          return v;
        },
      };
    },

    wrapBulk: function (sab, byteLength) {
      if (!sab) return null;
      let C = this;
      let i32 = new Int32Array(sab);
      let u8 = new Uint8Array(sab);
      let hdr = C.SAB_BULK_HDR;
      return {
        sab: sab,
        i32: i32,
        u8: u8,
        byteLength: byteLength,
        publish: function (which) {
          Atomics.store(i32, 0, which | 0);
          Atomics.add(i32, 1, 1);
        },
        seq: function () {
          return Atomics.load(i32, 1);
        },
        which: function () {
          return Atomics.load(i32, 0);
        },
        bufOffset: function (which) {
          return hdr + (which & 1) * byteLength;
        },
      };
    },

    bindProcessorSab: function (processor, options) {
      let po = (options && options.processorOptions) || {};
      processor.sab = this.wrapSab(po.sab);
      if (po.bulk && po.bulkBytes) {
        processor.bulk = this.wrapBulk(po.bulk, po.bulkBytes | 0);
      } else {
        processor.bulk = null;
      }
      return processor.sab;
    },

    peakAbs: function (ch) {
      if (!ch || !ch.length) return 0;
      let peak = 0;
      for (let i = 0; i < ch.length; i++) {
        let v = ch[i];
        if (v < 0) v = -v;
        if (v > peak) peak = v;
      }
      return peak;
    },

    sabWriteGraphPeaks: function (sab, inputs, parameters) {
      if (!sab) return;
      let base = this.SAB_SLOT_PEAK0;
      let i = 0;
      let nIn = inputs ? inputs.length : 0;
      for (let p = 0; p < nIn && i < 32; p++) {
        sab.setSlot(base + i, this.peakAbs(inputs[p] && inputs[p][0]));
        i++;
      }
      if (parameters) {
        for (let key in parameters) {
          if (i >= 32) break;
          sab.setSlot(base + i, this.peakAbs(parameters[key]));
          i++;
        }
      }
      Atomics.store(sab.i32, this.SAB_I_PEAK_N, i);
    },

    midiToHz: function (note) {
      if (!this._midiLut) {
        let lut = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
          lut[i] = Math.pow(2, (i - 69) / 12) * 440;
        }
        this._midiLut = lut;
      }
      note = note | 0;
      if (note < 0) return 0;
      if (note > 127) return this._midiLut[127];
      return this._midiLut[note];
    },
  };

  root.AppConfig = AppConfig;
})(typeof globalThis !== "undefined" ? globalThis : this);
