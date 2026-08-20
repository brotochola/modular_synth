class SequencerWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "baseHz",
        defaultValue: 440,
        minValue: 0.01,
        maxValue: 20000,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.sequence = null;
    this.bpm = 120;
    this.durationOfOneNote = 0;
    this.durationOfLoop = 0;
    this.currentNote = 0;
    this.lastPostedNote = -1;
    this.externalClock = false;
    this.prevClockSample = 0;
    this.port.onmessage = (e) => {
      this.sequence = e.data.seq;
      this.bpm = e.data.bpm;
      this.durationOfOneNote = (60000 / this.bpm) * 0.25;
      this.durationOfLoop = this.durationOfOneNote * 16;
    };
  }

  postPlayhead() {
    if (this.currentNote === this.lastPostedNote) return;
    this.lastPostedNote = this.currentNote;
    this.port.postMessage({ currentNote: this.currentNote });
  }

  process(inputs, outputs, parameters) {
    let seq = this.sequence;
    if (!seq || !this.durationOfLoop) return true;
    let outputChannel = outputs[0] && outputs[0][0];
    let triggerOutputChannel = outputs[1] && outputs[1][0];
    let hzChannel = outputs[2] && outputs[2][0];
    if (!outputChannel) return true;
    let n = outputChannel.length;
    let clockChannel = inputs[0] && inputs[0][0];

    if (clockChannel) {
      for (let i = 0; i < clockChannel.length; ++i) {
        let sample = clockChannel[i];
        if (sample > this.prevClockSample + 0.01) {
          if (!this.externalClock) {
            this.externalClock = true;
            this.currentNote = 0;
          } else {
            this.currentNote = (this.currentNote + 1) % 16;
          }
          this.postPlayhead();
        }
        this.prevClockSample = sample;
      }
    }

    if (!this.externalClock) {
      this.currentNote = Math.floor(
        ((currentTime * 1000) % this.durationOfLoop) / this.durationOfOneNote
      );
      this.postPlayhead();
    }

    let pitch = seq[this.currentNote] || 0;
    let gate = pitch != 0 ? 1 : 0;
    let baseArr = parameters.baseHz;
    let base0 = baseArr[0];
    let aRate = baseArr.length > 1;
    for (let i = 0; i < n; ++i) {
      outputChannel[i] = pitch;
      if (hzChannel) {
        hzChannel[i] = pitch * (aRate ? baseArr[i] : base0);
      }
    }
    if (triggerOutputChannel) {
      let tn = triggerOutputChannel.length;
      for (let i = 0; i < tn; ++i) {
        triggerOutputChannel[i] = gate;
      }
    }
    return true;
  }
}

registerProcessor("sequencer-worklet", SequencerWorklet);
