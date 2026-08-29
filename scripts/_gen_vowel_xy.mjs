import { writeFileSync } from "fs";

const letters = "qwertyuiopasdfghjklzxcvbnm".split("");
// F1 F2 F3 voice burst noiseHz F0
// voice 0 = only noise (s f j); burst = stop click; F0 separates vowels
const ph = {
  a: [920, 1100, 2450, 1.0, 0.0, 2000, 116],
  b: [270, 680, 1750, 1.0, 0.6, 480, 118],
  c: [400, 2200, 3600, 0.0, 0.12, 6000, 134],
  d: [300, 1780, 2550, 1.0, 0.55, 850, 122],
  e: [390, 2250, 2900, 1.0, 0.0, 2000, 136],
  f: [400, 1300, 2400, 0.0, 0.08, 1250, 128],
  g: [430, 980, 1950, 0.06, 0.22, 760, 114],
  h: [900, 1120, 2450, 0.32, 0.35, 2400, 116],
  i: [220, 2700, 3450, 1.0, 0.0, 2000, 156],
  j: [460, 720, 1800, 0.04, 0.18, 680, 108],
  k: [900, 1080, 2400, 0.28, 1.0, 1750, 116],
  l: [360, 920, 2900, 1.0, 0.06, 1400, 126],
  m: [200, 780, 1450, 1.0, 0.18, 250, 102],
  n: [230, 1620, 2050, 1.0, 0.18, 340, 108],
  o: [420, 640, 2300, 1.0, 0.0, 2000, 110],
  p: [390, 2050, 2600, 0.18, 1.0, 1550, 130],
  q: [220, 460, 2100, 0.35, 0.95, 1300, 104],
  r: [370, 1180, 2520, 0.88, 0.28, 1050, 124],
  s: [400, 2200, 3900, 0.0, 0.06, 6800, 136],
  t: [360, 2150, 3100, 0.16, 1.0, 4500, 132],
  u: [210, 430, 2050, 1.0, 0.0, 2000, 100],
  v: [270, 680, 1750, 1.0, 0.6, 480, 118],
  w: [210, 410, 2000, 1.0, 0.22, 550, 100],
  x: [390, 2000, 3300, 0.04, 0.75, 5200, 128],
  y: [240, 2550, 3300, 0.82, 0.28, 2600, 150],
  z: [400, 2200, 3800, 0.0, 0.08, 6400, 136],
};

const groups = [letters.slice(0, 12), letters.slice(12, 24), letters.slice(24)];
const gTag = ["a", "b", "c"];
const buses = [
  { prefix: "w", idx: null, y: 160 },
  { prefix: "f1", idx: 0, y: 340 },
  { prefix: "f2", idx: 1, y: 520 },
  { prefix: "f3", idx: 2, y: 700 },
  { prefix: "v", idx: 3, y: 880 },
  { prefix: "b", idx: 4, y: 1060 },
  { prefix: "n", idx: 5, y: 1240 },
  { prefix: "p", idx: 6, y: 1420 },
];

let cid = 0;
function conn(from, to, audioParam, numberOfOutput) {
  cid++;
  return {
    from,
    to,
    audioParam,
    numberOfOutput,
    id: "c" + String(cid).padStart(3, "0"),
  };
}

function base(id, ctor, x, y, extra = {}) {
  return {
    id,
    constructor: ctor,
    type: ctor,
    createdBy: "user",
    x: x + "px",
    y: y + "px",
    audioParams: extra.audioParams || {},
    node: extra.node || {},
    connections: extra.connections || [],
    ...extra.rest,
  };
}

function weightedFormula(keys, idx) {
  return "y=" + keys.map((k, i) => "x" + (i + 1) + "*" + ph[k][idx]).join("+");
}

function sumFormula(n) {
  return "y=" + Array.from({ length: n }, (_, i) => "x" + (i + 1)).join("+");
}

const destPrefixes = buses.map((b) => b.prefix);
const kbConns = [];
for (let i = 0; i < letters.length; i++) {
  const g = Math.floor(i / 12);
  const slot = i % 12;
  const jack = "in_" + slot;
  const tag = gTag[g];
  for (const prefix of destPrefixes) {
    kbConns.push(conn("kb", prefix + tag, jack, i));
  }
}
kbConns.push(conn("kb", "trill", "in_0", 3));

const components = [];

components.push(
  base("txt_title", "Text", 40, 20, {
    rest: {
      text:
        "LETRAS XY — fonema de cada letra (formantes, sin samples)\n" +
        "Vocales bien abiertas: a e i o u. s f j = ruido; p t k = golpe; m n = nasal.\n" +
        "Play, tocá el teclado. Plotter: F1 × F2.",
      valuesToSave: ["text"],
    },
  }),
);

components.push(
  base("kb", "KeyboardComponent", 40, 160, {
    connections: kbConns,
  }),
);

for (let g = 0; g < 3; g++) {
  const keys = groups[g];
  const tag = gTag[g];
  const x = 360 + g * 220;
  for (const bus of buses) {
    const formula =
      bus.idx == null ? sumFormula(keys.length) : weightedFormula(keys, bus.idx);
    components.push(
      base(bus.prefix + tag, "CustomProcessorComponent", x, bus.y, {
        rest: { formula, valuesToSave: ["formula"] },
      }),
    );
  }
}

function adder(id, y, formula, froms, extraOut = []) {
  const c = base(id, "CustomProcessorComponent", 1020, y, {
    connections: extraOut,
    rest: { formula, valuesToSave: ["formula"] },
  });
  froms.forEach((from, i) => {
    c.connections.unshift(conn(from, id, "in_" + i, 0));
  });
  return c;
}

components.push(
  adder("wsum", 160, "y=x1+x2+x3+0.001", ["wa", "wb", "wc"], [
    conn("wsum", "f1", "in_3", 0),
    conn("wsum", "f2", "in_3", 0),
    conn("wsum", "f3", "in_3", 0),
    conn("wsum", "voice", "in_3", 0),
    conn("wsum", "burst", "in_3", 0),
    conn("wsum", "nf", "in_3", 0),
    conn("wsum", "f0", "in_3", 0),
  ]),
);
components.push(
  adder("f1", 340, "y=(x1+x2+x3+0.39)/x4", ["f1a", "f1b", "f1c"], [
    conn("f1", "lerp_f1", "in_0", 0),
  ]),
);
components.push(
  adder("f2", 520, "y=(x1+x2+x3+2.25)/x4", ["f2a", "f2b", "f2c"], [
    conn("f2", "lerp_f2", "in_0", 0),
  ]),
);
components.push(
  adder("f3", 700, "y=(x1+x2+x3+2.6)/x4", ["f3a", "f3b", "f3c"], [
    conn("f3", "lerp_f3", "in_0", 0),
  ]),
);
components.push(
  adder(
    "voice",
    880,
    "y=Math.max(0,Math.min(1,(x1+x2+x3+0.001)/x4))",
    ["va", "vb", "vc"],
    [conn("voice", "lerp_voice", "in_0", 0)],
  ),
);
components.push(
  adder(
    "burst",
    1060,
    "y=Math.max(0,Math.min(1,(x1+x2+x3)/x4))",
    ["ba", "bb", "bc"],
    [conn("burst", "lerp_burst", "in_0", 0)],
  ),
);
components.push(
  adder("nf", 1240, "y=(x1+x2+x3+2)/x4", ["na", "nb", "nc"], [
    conn("nf", "lerp_nf", "in_0", 0),
  ]),
);
components.push(
  adder("f0", 1420, "y=(x1+x2+x3+0.125)/x4", ["pa", "pb", "pc"], [
    conn("f0", "lerp_f0", "in_0", 0),
  ]),
);
components.push(
  adder("gate", 1580, "y=x1+x2+x3", ["wa", "wb", "wc"], [
    conn("gate", "env_syll", "gate", 0),
    conn("gate", "env_burst", "gate", 0),
  ]),
);

components.push(
  base("trill", "CustomProcessorComponent", 240, 1420, {
    connections: [conn("trill", "osc_vib", "frequency", 0)],
    rest: { formula: "y=x1*32", valuesToSave: ["formula"] },
  }),
);

components.push(
  base("osc_vib", "Oscillator", 40, 1600, {
    audioParams: { detune: 0, frequency: 5.5 },
    node: { type: "sine" },
    connections: [conn("osc_vib", "amp_vib", "in_0", 0)],
  }),
);
components.push(
  base("amp_vib", "Amp", 240, 1600, {
    audioParams: { gain: 4 },
    connections: [conn("amp_vib", "osc_glot", "frequency", 0)],
  }),
);
components.push(
  base("noise_jit", "NoiseGenWithWorklet", 40, 1780, {
    connections: [conn("noise_jit", "filt_jit", "in_0", 0)],
  }),
);
components.push(
  base("filt_jit", "Filter", 240, 1780, {
    audioParams: { Q: 0.5, detune: 0, frequency: 35, gain: 0 },
    node: { type: "lowpass" },
    connections: [conn("filt_jit", "amp_jit", "in_0", 0)],
  }),
);
components.push(
  base("amp_jit", "Amp", 440, 1780, {
    audioParams: { gain: 1.6 },
    connections: [conn("amp_jit", "osc_glot", "frequency", 0)],
  }),
);
components.push(
  base("osc_glot", "Oscillator", 440, 1600, {
    audioParams: { detune: 0, frequency: 0 },
    node: { type: "sawtooth" },
    connections: [conn("osc_glot", "filt_tilt", "in_0", 0)],
  }),
);
components.push(
  base("filt_tilt", "Filter", 640, 1600, {
    audioParams: { Q: 0.6, detune: 0, frequency: 3400, gain: 0 },
    node: { type: "lowpass" },
    connections: [conn("filt_tilt", "crush_glot", "in_0", 0)],
  }),
);
components.push(
  base("crush_glot", "CustomProcessorComponent", 840, 1600, {
    connections: [conn("crush_glot", "mix_src", "in_0", 0)],
    rest: { formula: "y=Math.tanh(x1*1.6)", valuesToSave: ["formula"] },
  }),
);
components.push(
  base("noise_asp", "NoiseGenWithWorklet", 840, 1780, {
    connections: [conn("noise_asp", "filt_asp", "in_0", 0)],
  }),
);
components.push(
  base("filt_asp", "Filter", 1040, 1780, {
    audioParams: { Q: 0.9, detune: 0, frequency: 2000, gain: 0 },
    node: { type: "bandpass" },
    connections: [conn("filt_asp", "mix_nse", "in_0", 0)],
  }),
);
components.push(
  base("lerp_voice", "LerpComponent", 1240, 880, {
    audioParams: { time: 0.02 },
    connections: [
      conn("lerp_voice", "mix_src", "in_1", 0),
      conn("lerp_voice", "mix_nse", "in_1", 0),
    ],
  }),
);
components.push(
  base("lerp_burst", "LerpComponent", 1240, 1060, {
    audioParams: { time: 0.02 },
    connections: [conn("lerp_burst", "mix_nse", "in_2", 0)],
  }),
);
components.push(
  base("lerp_nf", "LerpComponent", 1240, 1240, {
    audioParams: { time: 0.03 },
    connections: [conn("lerp_nf", "filt_asp", "frequency", 0)],
  }),
);
components.push(
  base("env_burst", "EnvelopeGenerator", 1240, 1420, {
    audioParams: {
      attack: 0.004,
      attackcurve: 0.7,
      decay: 0.09,
      release: 0.06,
      sustain: 0,
      gate: 0,
    },
    connections: [conn("env_burst", "mix_nse", "in_3", 0)],
  }),
);
components.push(
  base("mix_src", "CustomProcessorComponent", 1460, 1600, {
    connections: [
      conn("mix_src", "filt_f1", "in_0", 0),
      conn("mix_src", "filt_f2", "in_0", 0),
      conn("mix_src", "filt_f3", "in_0", 0),
    ],
    rest: {
      formula: "y=x1*x2",
      valuesToSave: ["formula"],
    },
  }),
);
components.push(
  base("mix_nse", "CustomProcessorComponent", 1460, 1780, {
    connections: [conn("mix_nse", "mix_form", "in_3", 0)],
    rest: {
      formula: "y=Math.tanh(x1*((1-x2)*1.4+x3*x4*1.3))",
      valuesToSave: ["formula"],
    },
  }),
);
components.push(
  base("lerp_f0", "LerpComponent", 1240, 1600, {
    audioParams: { time: 0.03 },
    connections: [conn("lerp_f0", "osc_glot", "frequency", 0)],
  }),
);

components.push(
  base("lerp_f1", "LerpComponent", 1240, 340, {
    audioParams: { time: 0.022 },
    connections: [
      conn("lerp_f1", "filt_f1", "frequency", 0),
      conn("lerp_f1", "plot_x", "in_0", 0),
    ],
  }),
);
components.push(
  base("lerp_f2", "LerpComponent", 1240, 520, {
    audioParams: { time: 0.022 },
    connections: [
      conn("lerp_f2", "filt_f2", "frequency", 0),
      conn("lerp_f2", "plot_y", "in_0", 0),
    ],
  }),
);
components.push(
  base("lerp_f3", "LerpComponent", 1240, 700, {
    audioParams: { time: 0.022 },
    connections: [conn("lerp_f3", "filt_f3", "frequency", 0)],
  }),
);

components.push(
  base("filt_f1", "Filter", 1460, 340, {
    audioParams: { Q: 16, detune: 0, frequency: 400, gain: 0 },
    node: { type: "bandpass" },
    connections: [conn("filt_f1", "mix_form", "in_0", 0)],
  }),
);
components.push(
  base("filt_f2", "Filter", 1460, 520, {
    audioParams: { Q: 18, detune: 0, frequency: 2200, gain: 0 },
    node: { type: "bandpass" },
    connections: [conn("filt_f2", "mix_form", "in_1", 0)],
  }),
);
components.push(
  base("filt_f3", "Filter", 1460, 700, {
    audioParams: { Q: 8, detune: 0, frequency: 2900, gain: 0 },
    node: { type: "bandpass" },
    connections: [conn("filt_f3", "mix_form", "in_2", 0)],
  }),
);
components.push(
  base("mix_form", "Mixer", 1680, 520, {
    audioParams: { g0: 1.1, g1: 0.85, g2: 0.28, g3: 0.95, master: 0.55 },
    connections: [conn("mix_form", "amp_vca", "in_0", 0)],
  }),
);
components.push(
  base("env_syll", "EnvelopeGenerator", 1680, 340, {
    audioParams: {
      attack: 0.018,
      attackcurve: 0.4,
      decay: 0.07,
      release: 0.12,
      sustain: 0.84,
      gate: 0,
    },
    connections: [
      conn("env_syll", "amp_vca", "gain", 0),
      conn("env_syll", "plotter", "in_2", 0),
      conn("env_syll", "plotter", "in_3", 0),
      conn("env_syll", "plotter", "in_4", 0),
    ],
  }),
);
components.push(
  base("amp_vca", "Amp", 1880, 520, {
    audioParams: { gain: 0 },
    connections: [conn("amp_vca", "hp_lip", "in_0", 0)],
  }),
);
components.push(
  base("hp_lip", "Filter", 2080, 520, {
    audioParams: { Q: 0.7, detune: 0, frequency: 70, gain: 0 },
    node: { type: "highpass" },
    connections: [conn("hp_lip", "spec", "in_0", 0)],
  }),
);
components.push(
  base("spec", "Spectrogram", 2280, 400, {
    connections: [conn("spec", "comp_out", "in_0", 0)],
  }),
);
components.push(
  base("comp_out", "Compressor", 2280, 560, {
    audioParams: {
      attack: 0.003,
      knee: 10,
      ratio: 4,
      release: 0.1,
      threshold: -20,
    },
    connections: [conn("comp_out", "output", "in", 0)],
  }),
);

components.push(
  base("plot_x", "CustomProcessorComponent", 700, 20, {
    connections: [conn("plot_x", "plotter", "in_0", 0)],
    rest: { formula: "y=(x1-180)/800", valuesToSave: ["formula"] },
  }),
);
components.push(
  base("plot_y", "CustomProcessorComponent", 900, 20, {
    connections: [conn("plot_y", "plotter", "in_1", 0)],
    rest: { formula: "y=(x1-400)/2400", valuesToSave: ["formula"] },
  }),
);
components.push(
  base("plotter", "CanvasPlotter", 1100, 20, {
    audioParams: { clear: 10, range: 1, time: 0.05 },
    rest: { bipolar: false, lastOnly: true, valuesToSave: ["bipolar", "lastOnly"] },
  }),
);

const patch = {
  bpm: 88,
  outputX: "1680px",
  outputY: "720px",
  connections: [],
  cables: {
    gravity: 4000,
    stiffness: 0,
    damping: 0.88,
    slack: 0.5,
    beadRadius: 1.25,
    cableAlpha: 0.5,
  },
  components,
};

writeFileSync("samples/vowel-xy.json", JSON.stringify(patch, null, 2));
console.log("wrote", components.length, "modules", cid, "cables");
