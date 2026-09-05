class MidiFilePlayerWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "rate",
        defaultValue: 1,
        minValue: 0,
        maxValue: 10,
        automationRate: "k-rate",
      },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "midi-player");
    this.events = [];
    this.eventIndex = 0;
    this.tick = 0;
    this.tickFrac = 0;
    this.bpm = 120;
    this.ppqn = 480;
    this.playing = false;
    this.voiceCount = 1;
    this.noteHz = [0];
    this.activeNote = [-1];
    this.gateHigh = [0];
    this.playOn = 0;
    this.stopOn = 0;
    this.port.onmessage = (e) => this.onMessage(e.data || {});
  }

  allocVoices(n) {
    let count = Math.max(1, n | 0);
    this.voiceCount = count;
    this.noteHz = new Array(count).fill(0);
    this.activeNote = new Array(count).fill(-1);
    this.gateHigh = new Array(count).fill(0);
  }

  onMessage(d) {
    if (d.type == "load") {
      this.events = d.events || [];
      this.ppqn = d.ppqn || 480;
      if (d.bpm) this.bpm = d.bpm;
      this.allocVoices(d.voices || 1);
      this.stopPlayback(false);
    } else if (d.type == "play") {
      this.startPlayback();
    } else if (d.type == "stop") {
      this.stopPlayback(true);
    } else if (d.type == "setBpm") {
      if (d.bpm) this.bpm = d.bpm;
    }
  }

  startPlayback() {
    if (!this.events.length) return;
    this.eventIndex = 0;
    this.tick = 0;
    this.tickFrac = 0;
    for (let v = 0; v < this.voiceCount; v++) {
      this.noteHz[v] = 0;
      this.activeNote[v] = -1;
      this.gateHigh[v] = 0;
    }
    this.playing = true;
  }

  stopPlayback(notify) {
    this.playing = false;
    for (let v = 0; v < this.voiceCount; v++) {
      this.noteHz[v] = 0;
      this.activeNote[v] = -1;
      this.gateHigh[v] = 0;
    }
    this.eventIndex = 0;
    this.tick = 0;
    this.tickFrac = 0;
    if (notify && this.sab) this.sab.setEnded(true);
  }

  noteToHz(note) {
    return AppConfig.midiToHz(note);
  }

  applyEvent(ev) {
    let v = ev.voice | 0;
    if (v < 0 || v >= this.voiceCount) return;
    if (ev.type == 1) {
      this.noteHz[v] = this.noteToHz(ev.note);
      this.activeNote[v] = ev.note;
      this.gateHigh[v] = 1;
    } else if (ev.type == 0) {
      if (this.activeNote[v] == ev.note || this.activeNote[v] < 0) {
        this.noteHz[v] = 0;
        this.activeNote[v] = -1;
        this.gateHigh[v] = 0;
      }
    }
  }

  process(inputs, outputs, parameters) {
    let playCh = inputs[0] && inputs[0][0];
    let stopCh = inputs[1] && inputs[1][0];
    let out0 = outputs[0] && outputs[0][0];
    if (!out0) return true;
    let n = out0.length;
    let rate = parameters.rate[0];
    if (!(rate > 0) || isNaN(rate)) rate = 1;
    let ticksPerSample =
      ((((this.bpm || 120) / 60) * (this.ppqn || 480)) / sampleRate) * rate;
    let vc = this.voiceCount;
    let noteOuts = this._noteOuts || (this._noteOuts = []);
    let trigOuts = this._trigOuts || (this._trigOuts = []);
    for (let v = 0; v < vc; v++) {
      noteOuts[v] = outputs[v * 2] && outputs[v * 2][0];
      trigOuts[v] = outputs[v * 2 + 1] && outputs[v * 2 + 1][0];
    }

    for (let i = 0; i < n; i++) {
      let stopIn = stopCh ? stopCh[i] : 0;
      let stopOn = AppConfig.schmitt(this.stopOn, stopIn);
      if (stopOn && !this.stopOn) this.stopPlayback(true);
      this.stopOn = stopOn;
      let trigIn = playCh ? playCh[i] : 0;
      let playOn = AppConfig.schmitt(this.playOn, trigIn);
      if (playOn && !this.playOn && !this.playing) this.startPlayback();
      this.playOn = playOn;

      if (this.playing) {
        this.tickFrac += ticksPerSample;
        while (this.tickFrac >= 1) {
          this.tickFrac -= 1;
          this.tick += 1;
        }
        while (
          this.eventIndex < this.events.length &&
          this.events[this.eventIndex].tick <= this.tick
        ) {
          this.applyEvent(this.events[this.eventIndex]);
          this.eventIndex++;
        }
        if (this.eventIndex >= this.events.length) {
          this.playing = false;
          for (let v = 0; v < vc; v++) {
            this.noteHz[v] = 0;
            this.activeNote[v] = -1;
            this.gateHigh[v] = 0;
          }
          if (this.sab) this.sab.setEnded(true);
        }
      }

      for (let v = 0; v < vc; v++) {
        let noteOut = noteOuts[v];
        let trigOut = trigOuts[v];
        if (noteOut) noteOut[i] = this.noteHz[v] || 0;
        if (trigOut) trigOut[i] = this.gateHigh[v] || 0;
      }
    }
    if (this.sab) {
      AppConfig.sabWriteGraphPeaks(this.sab, inputs, parameters);
      this.sab.publish();
    }
    return true;
  }
}

registerProcessor("midi-player-worklet", MidiFilePlayerWorklet);
