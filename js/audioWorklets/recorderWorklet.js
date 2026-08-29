class RecorderWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "playbackRate",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "a-rate",
      },
      {
        name: "currentTime",
        defaultValue: 0,
        minValue: 0,
        maxValue: 3600,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    if (globalThis.AudioProfile) AudioProfile.attach(this, "recorder");
    this.bpm = 120;
    this.beats = 8;
    this.buffer = new Float32Array(1);
    this.writeHead = 0;
    this.playHead = 0;
    this.toggleLatched = false;
    this.playing = false;
    this.loop = true;
    this.thru = true;
    this.wasRecording = false;
    this.lastCurrentTime = 0;
    this.statusCounter = 0;
    this.peakCols = 128;
    this.resizeBuffer();
    this.port.onmessage = (e) => this.onMessage(e.data || {});
  }

  onMessage(d) {
    if (d.bpm != null || d.beats != null) {
      if (d.bpm != null) this.bpm = d.bpm;
      if (d.beats != null) this.beats = d.beats;
      this.resizeBuffer();
      this.sendPeaks();
    }
    if (d.toggleRec) {
      this.toggleLatched = !this.toggleLatched;
    }
    if (d.play) {
      this.playing = !this.playing;
      if (!this.playing) this.sendStatus(true);
    }
    if (d.clear) {
      this.buffer.fill(0);
      this.writeHead = 0;
      this.playHead = 0;
      this.sendPeaks();
      this.sendStatus(true);
    }
    if (d.loop !== undefined) this.loop = !!d.loop;
    if (d.thru !== undefined) this.thru = !!d.thru;
    if (d.seekNorm != null) {
      let n = this.buffer.length;
      this.playHead = Math.max(0, Math.min(n - 1, d.seekNorm * n));
    }
    if (d.seekSec != null) {
      this.playHead = Math.max(
        0,
        Math.min(this.buffer.length - 1, d.seekSec * sampleRate),
      );
    }
  }

  bufferLengthSamples() {
    let bpm = this.bpm > 0 ? this.bpm : 120;
    let beats = this.beats > 0 ? this.beats : 8;
    return Math.max(1, Math.floor(beats * (60 / bpm) * sampleRate));
  }

  resizeBuffer() {
    let newLen = this.bufferLengthSamples();
    let old = this.buffer || new Float32Array(0);
    let next = new Float32Array(newLen);
    next.set(old.subarray(0, Math.min(old.length, newLen)));
    this.buffer = next;
    if (this.writeHead >= newLen) this.writeHead = 0;
    if (this.playHead >= newLen) this.playHead = 0;
  }

  buildPeaks() {
    let buf = this.buffer;
    let n = buf.length;
    let cols = this.peakCols;
    let peaks = new Float32Array(cols * 2);
    if (n < 1) return peaks;
    for (let c = 0; c < cols; c++) {
      let start = Math.floor((c / cols) * n);
      let end = Math.floor(((c + 1) / cols) * n);
      if (end <= start) end = start + 1;
      let mn = 0;
      let mx = 0;
      for (let i = start; i < end && i < n; i++) {
        let v = buf[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      peaks[c * 2] = mn;
      peaks[c * 2 + 1] = mx;
    }
    return peaks;
  }

  sendPeaks() {
    let peaks = this.buildPeaks();
    this.port.postMessage(
      { peaks, durationSec: this.buffer.length / sampleRate },
      [peaks.buffer],
    );
  }

  sendStatus(force) {
    this.port.postMessage({
      playHeadNorm:
        this.buffer.length > 0 ? this.playHead / this.buffer.length : 0,
      recording: !!(this.wasRecording || this.toggleLatched),
      playing: !!this.playing,
      toggleLatched: !!this.toggleLatched,
      force: !!force,
    });
  }

  readSample(pos) {
    let buf = this.buffer;
    let n = buf.length;
    if (n < 2) return buf[0] || 0;
    let i0 = Math.floor(pos) % n;
    if (i0 < 0) i0 += n;
    let i1 = (i0 + 1) % n;
    let frac = pos - Math.floor(pos);
    return buf[i0] + (buf[i1] - buf[i0]) * frac;
  }

  process(inputs, outputs, parameters) {
    let audioIn = (inputs[0] && inputs[0][0]) || null;
    let gateIn = (inputs[1] && inputs[1][0]) || null;
    let output = (outputs[0] && outputs[0][0]) || null;
    if (!output) return true;

    let rates = parameters.playbackRate;
    let times = parameters.currentTime;
    let ct = times[0] || 0;
    if (ct !== this.lastCurrentTime) {
      this.lastCurrentTime = ct;
      this.playHead = Math.max(
        0,
        Math.min(this.buffer.length - 1, ct * sampleRate),
      );
    }

    let n = output.length;
    let buf = this.buffer;
    let bufLen = buf.length;
    let recordingAny = false;

    for (let i = 0; i < n; i++) {
      let gate = gateIn ? gateIn[i] || 0 : 0;
      let gateHigh = gate >= 1;
      let recording = gateHigh || this.toggleLatched;
      if (recording) recordingAny = true;

      let input = audioIn ? audioIn[i] || 0 : 0;

      if (recording && bufLen > 0) {
        buf[this.writeHead] = input;
        this.writeHead++;
        if (this.writeHead >= bufLen) this.writeHead = 0;
      }

      let playSamp = 0;
      if (this.playing && bufLen > 0) {
        playSamp = this.readSample(this.playHead);
        let rate = rates.length > 1 ? rates[i] : rates[0];
        this.playHead += rate;
        if (this.playHead >= bufLen) {
          if (this.loop) {
            this.playHead = this.playHead % bufLen;
          } else {
            this.playHead = bufLen - 1;
            this.playing = false;
          }
        } else if (this.playHead < 0) {
          if (this.loop) {
            this.playHead = ((this.playHead % bufLen) + bufLen) % bufLen;
          } else {
            this.playHead = 0;
            this.playing = false;
          }
        }
      }

      output[i] = playSamp + (this.thru ? input : 0);
    }

    if (this.wasRecording && !recordingAny) {
      this.sendPeaks();
    }
    this.wasRecording = recordingAny;

    this.statusCounter++;
    if (this.statusCounter >= 12) {
      this.statusCounter = 0;
      if (recordingAny) this.sendPeaks();
      this.port.postMessage({
        playHeadNorm: bufLen > 0 ? this.playHead / bufLen : 0,
        recording: recordingAny,
        playing: !!this.playing,
        toggleLatched: !!this.toggleLatched,
      });
    }

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);
