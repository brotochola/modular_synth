class NumberDisplay extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastPosted = NaN;
    this.lastPostTime = 0;
  }

  process(inputs) {
    let input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    let number = input[input.length - 1] || 0;
    if (Math.abs(number - this.lastPosted) < 0.0005) return true;
    if (currentTime - this.lastPostTime < 1 / 15) return true;
    this.lastPosted = number;
    this.lastPostTime = currentTime;
    this.port.postMessage({ number });
    return true;
  }
}

registerProcessor("number-display", NumberDisplay);
