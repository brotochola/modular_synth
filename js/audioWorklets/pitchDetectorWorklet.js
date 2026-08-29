class YinProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "yin");
    this.sampleRate = sampleRate;
    this.threshold = 0.1;
    this.bufferSize = 2048;
    this.hop = 1024;
    this.fftN = 4096;
    this.ring = new Float32Array(this.bufferSize);
    this.ringWrite = 0;
    this.samplesSeen = 0;
    this.sinceHop = 0;
    this.haveWindow = false;
    this.linear = new Float32Array(this.bufferSize);
    this.yinBuffer = new Float32Array(this.bufferSize / 2);
    this.re = new Float32Array(this.fftN);
    this.im = new Float32Array(this.fftN);
    this.prefix = new Float32Array(this.bufferSize + 1);
    this.pitch = 0;
    // ponytail: FFT round-trip check. Upgrade = scipy golden if pitch math drifts.
    this.re[0] = 1;
    this.fftRadix2(this.re, this.im, this.fftN, false);
    for (let i = 0; i < this.fftN; i++) {
      let a = this.re[i];
      let b = this.im[i];
      this.re[i] = a * a + b * b;
      this.im[i] = 0;
    }
    this.fftRadix2(this.re, this.im, this.fftN, true);
    if (Math.abs(this.re[0] - 1) > 1e-3) {
      console.error("yin-fft self-check fail", this.re[0]);
    }
    this.re.fill(0);
    this.im.fill(0);
  }

  static get parameterDescriptors() {
    return [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const inputChannel = input[0];
    if (!inputChannel) return true;
    let ring = this.ring;
    let size = this.bufferSize;
    let nIn = inputChannel.length;
    for (let i = 0; i < nIn; i++) {
      ring[this.ringWrite] = inputChannel[i];
      this.ringWrite++;
      if (this.ringWrite >= size) this.ringWrite = 0;
    }
    this.samplesSeen += nIn;
    if (this.samplesSeen >= size) this.haveWindow = true;
    this.sinceHop += nIn;
    if (this.haveWindow && this.sinceHop >= this.hop) {
      this.sinceHop -= this.hop;
      let pitch = this.detectPitch();
      if (pitch != null) this.pitch = pitch;
    }
    let out = outputs[0] && outputs[0][0];
    if (out) out.fill(this.pitch);
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }

  copyLinear() {
    let w = this.ringWrite;
    let size = this.bufferSize;
    let src = this.ring;
    let dst = this.linear;
    dst.set(src.subarray(w), 0);
    if (w) dst.set(src.subarray(0, w), size - w);
  }

  fftRadix2(re, im, n, inverse) {
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        let tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        let ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
      let m = n >> 1;
      while (m >= 1 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }
    for (let size = 2; size <= n; size <<= 1) {
      let half = size >> 1;
      let ang = ((inverse ? 2 : -2) * Math.PI) / size;
      let wr = Math.cos(ang);
      let wi = Math.sin(ang);
      for (let i = 0; i < n; i += size) {
        let ar = 1;
        let ai = 0;
        for (let k = 0; k < half; k++) {
          let i0 = i + k;
          let i1 = i0 + half;
          let tr = ar * re[i1] - ai * im[i1];
          let ti = ar * im[i1] + ai * re[i1];
          re[i1] = re[i0] - tr;
          im[i1] = im[i0] - ti;
          re[i0] += tr;
          im[i0] += ti;
          let nr = ar * wr - ai * wi;
          ai = ar * wi + ai * wr;
          ar = nr;
        }
      }
    }
    if (inverse) {
      let inv = 1 / n;
      for (let i = 0; i < n; i++) {
        re[i] *= inv;
        im[i] *= inv;
      }
    }
  }

  detectPitch() {
    this.copyLinear();
    let x = this.linear;
    let N = this.bufferSize;
    let nFft = this.fftN;
    let re = this.re;
    let im = this.im;
    re.fill(0);
    im.fill(0);
    re.set(x);
    this.fftRadix2(re, im, nFft, false);
    for (let i = 0; i < nFft; i++) {
      let a = re[i];
      let b = im[i];
      re[i] = a * a + b * b;
      im[i] = 0;
    }
    this.fftRadix2(re, im, nFft, true);

    let prefix = this.prefix;
    prefix[0] = 0;
    for (let i = 0; i < N; i++) {
      let s = x[i];
      prefix[i + 1] = prefix[i] + s * s;
    }

    let yinBuffer = this.yinBuffer;
    let maxTau = yinBuffer.length;
    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    let runningSum = 0;
    for (let tau = 2; tau < maxTau; tau++) {
      let d = prefix[N - tau] + (prefix[N] - prefix[tau]) - 2 * re[tau];
      if (d < 0) d = 0;
      yinBuffer[tau] = d;
      runningSum += d;
      yinBuffer[tau] *= tau / runningSum;
    }

    let minTau = 2;
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
    if (tauEstimate === -1) return null;

    let betterTau;
    const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
    const x2 =
      tauEstimate + 1 < yinBuffer.length ? tauEstimate + 1 : tauEstimate;
    if (x0 === tauEstimate) {
      betterTau =
        yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
    } else if (x2 === tauEstimate) {
      betterTau =
        yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
    } else {
      const s0 = yinBuffer[x0];
      const s1 = yinBuffer[tauEstimate];
      const s2 = yinBuffer[x2];
      betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }
    return this.sampleRate / betterTau;
  }
}

registerProcessor("yin-processor", YinProcessor);
