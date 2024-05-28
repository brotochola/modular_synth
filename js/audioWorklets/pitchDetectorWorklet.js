class YinProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = sampleRate;
    this.threshold = 0.1; // Threshold for YIN algorithm
    this.buffer = [];
  }

  static get parameterDescriptors() {
    return [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length === 0) return true;

    const inputChannel = input[0];
    this.buffer.push(...inputChannel);

    // Process buffer in chunks of 2048 samples
    const bufferSize = 2048;
    if (this.buffer.length >= bufferSize) {
      const segment = this.buffer.slice(0, bufferSize);
      this.buffer = this.buffer.slice(bufferSize);

      const pitch = this.detectPitch(segment, this.sampleRate);
      if (pitch !== null) {
        // this.port.postMessage(pitch);
        for (let i = 0; i < outputs[0][0].length; i++) {
          outputs[0][0][i] = pitch;
        }
      }
    }

    return true;
  }

  detectPitch(buffer, sampleRate) {
    const yinBuffer = new Float32Array(buffer.length / 2);
    let minTau = 2;
    let maxTau = yinBuffer.length;

    // Step 1: Difference function
    for (let tau = minTau; tau < maxTau; tau++) {
      yinBuffer[tau] = 0;
      for (let j = 0; j < maxTau; j++) {
        let delta = buffer[j] - buffer[j + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference function
    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    let runningSum = 0;
    for (let tau = 2; tau < maxTau; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // Step 3: Absolute threshold
    let tauEstimate = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (yinBuffer[tau] < this.threshold) {
        while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Step 4: Parabolic interpolation
    if (tauEstimate === -1) {
      return null;
    }

    let betterTau;
    const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
    const x2 =
      tauEstimate + 1 < yinBuffer.length ? tauEstimate + 1 : tauEstimate;
    if (x0 === tauEstimate) {
      if (yinBuffer[tauEstimate] <= yinBuffer[x2]) {
        betterTau = tauEstimate;
      } else {
        betterTau = x2;
      }
    } else if (x2 === tauEstimate) {
      if (yinBuffer[tauEstimate] <= yinBuffer[x0]) {
        betterTau = tauEstimate;
      } else {
        betterTau = x0;
      }
    } else {
      const s0 = yinBuffer[x0];
      const s1 = yinBuffer[tauEstimate];
      const s2 = yinBuffer[x2];
      betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  }
}

registerProcessor("yin-processor", YinProcessor);
