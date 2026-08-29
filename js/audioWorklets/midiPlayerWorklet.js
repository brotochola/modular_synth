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

  constructor() {
    super();
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
    this.gateSamplesLeft = [0];
    this.gateLen = Math.max(1, Math.floor(sampleRate * 0.002));
    this.prevTrig = 0;
    this.prevStop = 0;
    this.port.onmessage = (e) => this.onMessage(e.data || {});
  }

  allocVoices(n) {
    let count = Math.max(1, n | 0);
    this.voiceCount = count;
    this.noteHz = new Array(count).fill(0);
    this.activeNote = new Array(count).fill(-1);
    this.gateSamplesLeft = new Array(count).fill(0);
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
      this.gateSamplesLeft[v] = 0;
    }
    this.playing = true;
  }

  stopPlayback(notify) {
    this.playing = false;
    for (let v = 0; v < this.voiceCount; v++) {
      this.noteHz[v] = 0;
      this.activeNote[v] = -1;
      this.gateSamplesLeft[v] = 0;
    }
    this.eventIndex = 0;
    this.tick = 0;
    this.tickFrac = 0;
    if (notify) this.port.postMessage({ ended: true });
  }

  noteToHz(note) {
    return (440 / 32) * Math.pow(2, (note - 9) / 12);
  }

  applyEvent(ev) {
    let v = ev.voice | 0;
    if (v < 0 || v >= this.voiceCount) return;
    if (ev.type == 1) {
      this.noteHz[v] = this.noteToHz(ev.note);
      this.activeNote[v] = ev.note;
      this.gateSamplesLeft[v] = this.gateLen;
    } else if (ev.type == 0) {
      if (this.activeNote[v] == ev.note || this.activeNote[v] < 0) {
        this.noteHz[v] = 0;
        this.activeNote[v] = -1;
      }
    }
  }

  process(inputs, outputs, parameters) {
    try {
      let playCh = ((inputs || [])[0] || [])[0];
      let stopCh = ((inputs || [])[1] || [])[0];
      let out0 = ((outputs || [])[0] || [])[0];
      if (!out0) return true;

      let n = out0.length;
      let rate = parameters.rate[0];
      if (!(rate > 0) || isNaN(rate)) rate = 1;
      let ticksPerSample =
        ((((this.bpm || 120) / 60) * (this.ppqn || 480)) / sampleRate) * rate;

      for (let i = 0; i < n; i++) {
        let stopIn = stopCh ? stopCh[i] || 0 : 0;
        if (stopIn > 0 && this.prevStop <= 0) {
          this.stopPlayback(true);
        }
        this.prevStop = stopIn;

        let trigIn = playCh ? playCh[i] || 0 : 0;
        if (trigIn > 0 && this.prevTrig <= 0 && !this.playing) {
          this.startPlayback();
        }
        this.prevTrig = trigIn;

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
            for (let v = 0; v < this.voiceCount; v++) {
              this.noteHz[v] = 0;
              this.activeNote[v] = -1;
            }
            this.port.postMessage({ ended: true });
          }
        }

        for (let v = 0; v < this.voiceCount; v++) {
          let noteOut = ((outputs[v * 2] || [])[0] || []);
          let trigOut = ((outputs[v * 2 + 1] || [])[0] || []);
          if (noteOut.length) noteOut[i] = this.noteHz[v] || 0;
          if (trigOut.length) {
            if (this.gateSamplesLeft[v] > 0) {
              trigOut[i] = 1;
              this.gateSamplesLeft[v]--;
            } else {
              trigOut[i] = 0;
            }
          }
        }
      }
    } catch (e) {
      this.port.postMessage(String(e));
    }
    return true;
  }
}

registerProcessor("midi-player-worklet", MidiFilePlayerWorklet);
