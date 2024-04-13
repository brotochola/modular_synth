class SequencerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      // console.log(e.data);
      this.sequence = e.data.seq;
      this.bpm = e.data.bpm;
      this.durationOfOneNote = 60000 / this.bpm;
      this.durationOfLoop = this.durationOfOneNote * 16;
      this.port.postMessage({ data: e.data });
    };
    this.timeItStarted = Date.now();
  }

  process(inputs, outputs) {
    let output = (outputs || [])[0] || [];
    this.currentTime = Date.now() - this.timeItStarted;
    this.currentNote = Math.floor(
      (this.currentTime % this.durationOfLoop) / this.durationOfOneNote
    );
    // this.port.postMessage({
    //   data: "hola",
    //   currentNote: this.currentNote,
    //   durationOfOneNote: this.durationOfOneNote,
    // });

    for (let channel = 0; channel < output.length; ++channel) {
      let outputChannel = (output || [])[channel] || [];

      for (let i = 0; i < outputChannel.length; ++i) {
        outputChannel[i] = this.sequence[this.currentNote] ;

        // this.port.postMessage({
        //   data: "hola",
        //   note: this.sequence[this.currentNote],
        // });

        // this.port.postMessage(inputChannel1[i], inputChannel2[i]);
        // this.port.postMessage(outputChannel[i]);

        // this.port.postMessage({ data: "hola", output: outputChannel[i] });

        // outputChannel[i] = inputChannel[i] * 0.5;
      }
    }
    // this.port.postMessage({ data: "hola", counter });
    // this.lastTime = Date.now();
    return true;
  }
}

registerProcessor("sequencer-worklet", SequencerWorklet);
