// ponytail: bpm pulse-on-tick; upgrade = AudioWorklet integration test
function ticksInWindow(timeStart, timeEnd, bpm, rate) {
  let a = Math.floor(timeStart * (bpm / 60) * rate);
  let b = Math.floor(timeEnd * (bpm / 60) * rate);
  return b - a;
}

console.assert(ticksInWindow(0, 1, 120, 1) === 2, "x1: 2 beats/sec at 120");
console.assert(ticksInWindow(0, 1, 120, 4) === 8, "*4: 8 pulses/sec");
console.assert(ticksInWindow(0, 4, 120, 0.25) === 2, "/4: 2 pulses in 4s");
console.log("bpm pulse rate check ok");
