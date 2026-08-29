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
    /** Rising-edge compare for gates/trigs (prev < thr && cur >= thr). */
    TRIG_THRESHOLD: 0.5,
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
      let thr = this.TRIG_THRESHOLD;
      return prev < thr && cur >= thr;
    },
  };

  root.AppConfig = AppConfig;
})(typeof globalThis !== "undefined" ? globalThis : this);
