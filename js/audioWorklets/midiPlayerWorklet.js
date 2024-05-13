class MidiFilePlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => {
      this.noteValue = 0;
  
      if (e.data.event == "note_on") {       
        this.noteValue = e.data.value;
      } else if (e.data.event == "note_off") {
        this.noteValue = 0;
       
      }
    };
  }

  process(inputs, outputs) {
    // this.port.postMessage("FORMULA " + this.formula)
    try {
      let input1 = (inputs || [])[0] || [];
      let audioOutput = ((outputs || [])[0] || [])[0] || [];
      let triggerOutput = ((outputs || [])[1] || [])[0] || [];
      // this.port.postMessage(inputs);

      for (let i = 0; i < audioOutput.length; ++i) {
        audioOutput[i] = this.noteValue;
        triggerOutput[i] = this.noteValue!=this.prevNote?1:0;
        // this.port.postMessage(inputChannel1[i], inputChannel2[i]);
        // this.port.postMessage(outputChannel[i]);

        // this.port.postMessage({ data: "hola", output: outputChannel[i] });

        // outputChannel[i] = inputChannel[i] * 0.5;
      }
      this.prevNote=this.noteValue
      // this.port.postMessage({ data: "hola", counter });
    } catch (e) {
      this.port.postMessage(e);
    }
    return true;
  }
}

registerProcessor("midi-player-worklet", MidiFilePlayerWorklet);
