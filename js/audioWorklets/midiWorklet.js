class MidiWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.note = 0;
    this.freq = 0;
    this.velocity = 0;
    this.modWheel = 0;
    this.pitchBend = 0;
    this.port.onmessage = (e) => {
      if (e.data.type == "note") {
        //HANDLE VELOCITIES
        if (e.data.note != this.note) {
          //IF YOU PRESS A SECOND KEY BEFORE YOU RELEASED THE FIRST, THE VELOCITY STAYS IN 1
          this.velocity = 0;
          this.rememberVelocity = e.data.velocity;
        } else {
          this.velocity = e.data.velocity;
        }
        //HANDLE NOTES
        if (e.data.velocity == 0 && this.note == e.data.note) {
          this.note = 0;
        } else {
          this.note = e.data.note;
          this.freq = this.midi2Freq(e.data.note);
        }
      } else if (e.data.type == "modWheel") {
        this.modWheel = e.data.velocity;
      } else if (e.data.type == "pitchBend") {
        this.pitchBend = e.data.velocity;
      }
    };
  }
  midi2Freq(midiNote) {
    return Math.pow(2, (midiNote - 69) / 12) * 440;
  }

  process(inputs, outputs) {
    try {
      let noteOutput = ((outputs || [])[0] || [])[0];
      let velOutput = ((outputs || [])[1] || [])[0];
      let modWheelOutput = ((outputs || [])[2] || [])[0];
      let pitchBendOutput = ((outputs || [])[3] || [])[0];

      for (let i = 0; i < velOutput.length; ++i) {
        noteOutput[i] = this.freq;
        velOutput[i] = this.velocity;
        modWheelOutput[i] = this.modWheel;
        pitchBendOutput[i] = this.pitchBend;
      }

      //THIS FORCE AN INTERRUMPTION IN THE VELOCITY IN CASE THE NOTES WERE PLAYED TOO FAST,
      // PLAY A SECOND NOTE BEFORE RELEASING THE FIRST
      if (this.rememberVelocity) {
        this.velocity = this.rememberVelocity;
        this.rememberVelocity = null;
      }

      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("midi-worklet", MidiWorklet);
