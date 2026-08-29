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

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
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
    this.peakScratch = new Float32Array(256);
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
      this.seekToSample(0);
      this.sendPeaks();
      this.sendStatus(true);
    }
    if (d.loop !== undefined) this.loop = !!d.loop;
    if (d.thru !== undefined) this.thru = !!d.thru;
    if (d.seekNorm != null) {
      this.seekToSample(d.seekNorm * this.buffer.length);
    }
    if (d.seekSec != null) {
      this.seekToSample(d.seekSec * sampleRate);
    }
  }

  seekToSample(pos) {
    let n = this.buffer.length;
    let p = Math.max(0, Math.min(n > 0 ? n - 1 : 0, pos));
    this.playHead = p;
    this.writeHead = Math.floor(p);
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
    let peaks = this.peakScratch;
    peaks.fill(0);
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
    let sab = this.sab;
    if (!sab) return;
    let base = AppConfig.SAB_RING_BASE;
    for (let i = 0; i < peaks.length; i++) sab.f32[base + i] = peaks[i];
    sab.setSlot(5, this.buffer.length / sampleRate);
    sab.setNote(sab.getNote() + 1);
  }

  sendStatus(force) {
    let sab = this.sab;
    if (!sab) return;
    let n = this.buffer.length;
    sab.setSlot(0, n > 0 ? this.playHead / n : 0);
    sab.setSlot(1, n > 0 ? this.writeHead / n : 0);
    let bits = 0;
    if (this.wasRecording || this.toggleLatched) bits |= AppConfig.SAB_REC_RECORDING;
    if (this.playing) bits |= AppConfig.SAB_REC_PLAYING;
    if (this.toggleLatched) bits |= AppConfig.SAB_REC_LATCH;
    sab.setRec(bits);
    if (force) sab.publish();
  }

  readSample(pos) {
    let buf = this.buffer;
    let n = buf.length;
    if (n < 2) return buf[0] || 0;
    let i0 = Math.floor(pos);
    if (i0 >= n) i0 -= n;
    if (i0 < 0) i0 += n;
    let i1 = i0 + 1;
    if (i1 >= n) i1 = 0;
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
      this.seekToSample(ct * sampleRate);
    }

    let n = output.length;
    let buf = this.buffer;
    let bufLen = buf.length;
    let recordingAny = false;
    let recSynced = false;

    for (let i = 0; i < n; i++) {
      let gate = gateIn ? gateIn[i] || 0 : 0;
      let gateHigh = gate >= 1;
      let recording = gateHigh || this.toggleLatched;
      if (recording) recordingAny = true;

      let input = audioIn ? audioIn[i] || 0 : 0;

      if (recording && bufLen > 0) {
        if (!this.wasRecording && !recSynced) {
          this.writeHead = Math.floor(this.playHead);
          if (this.writeHead >= bufLen) this.writeHead -= bufLen;
          if (this.writeHead < 0) this.writeHead = 0;
          recSynced = true;
        }
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
            while (this.playHead >= bufLen) this.playHead -= bufLen;
          } else {
            this.playHead = bufLen - 1;
            this.playing = false;
          }
        } else if (this.playHead < 0) {
          if (this.loop) {
            while (this.playHead < 0) this.playHead += bufLen;
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
      this.sendStatus(false);
    }

    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);
