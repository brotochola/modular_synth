class SequencerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();

    this.port.onmessage = (e) => {
      // console.log(e.data);
      this.sequence = e.data.seq;
      this.bpm = e.data.bpm;
      this.durationOfOneNote = (60000 / this.bpm) * 0.25;
      this.durationOfLoop = this.durationOfOneNote * 16;
      this.port.postMessage({ data: e.data });
    };
  }

  process(inputs, outputs, parameters) {
    // this.port.postMessage({parameters})
    let output = (outputs || [])[0] || [];
    let triggerOutput = (outputs || [])[1] || [];
    this.currentTime = currentTime * 1000;
    this.currentNote = Math.floor(
      (this.currentTime % this.durationOfLoop) / this.durationOfOneNote
    );
    // this.port.postMessage({
    //   data: "hola",
    //   currentNote: this.currentNote,
    //   durationOfOneNote: this.durationOfOneNote,
    // });

    let outputChannel = (output || [])[0] || [];
    let triggerOutputChannel = (triggerOutput || [])[0] || [];

    for (let i = 0; i < outputChannel.length; ++i) {
      outputChannel[i] = (this.sequence || [])[this.currentNote];
      if (this.prevNote != this.currentNote) triggerOutputChannel[i] = 1;
      else triggerOutputChannel[i] = 0;

      // this.port.postMessage({
      //   data: "hola",
      //   note: this.sequence[this.currentNote],
      // });

      // this.port.postMessage(inputChannel1[i], inputChannel2[i]);
      // this.port.postMessage(outputChannel[i]);

      // this.port.postMessage({ data: "hola", output: outputChannel[i] });

      // outputChannel[i] = inputChannel[i] * 0.5;
    }

    this.prevNote = this.currentNote;

    // this.port.postMessage({ data: "hola", counter });
    // this.lastTime = Date.now();
    return true;
  }
}

function getNextBeat() {
  let durationOf4Beats = (60 / 120) * 4;
  return durationOf4Beats - (currentTime % durationOf4Beats);
}

registerProcessor("sequencer-worklet", SequencerWorklet);
