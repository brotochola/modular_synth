function rearrangeArrays(inputArray, outputArray) {
  // Create a Set from the inputArray for quick lookup
  let inputSet = new Set(inputArray);
  
  // Initialize the result array
  let resultArray = [];
  
  // Keep track of new values from the inputArray that need to be inserted
  let newValues = inputArray.filter(value => !outputArray.includes(value));
  
  // Iterate through the outputArray and maintain the order of elements that are in inputArray
  for (let value of outputArray) {
      if (inputSet.has(value)) {
          resultArray.push(value);
      } else {
          // Add a placeholder for elements not in the inputArray
          resultArray.push(null);
      }
  }
  
  // Fill the placeholders with new values from the inputArray
  let newIndex = 0;
  for (let i = 0; i < resultArray.length; i++) {
      if (resultArray[i] === null && newIndex < newValues.length) {
          resultArray[i] = newValues[newIndex];
          newIndex++;
      }
  }
  
  // If there are still new values left, add them to the end
  while (newIndex < newValues.length) {
      resultArray.push(newValues[newIndex]);
      newIndex++;
  }
  
  return resultArray;
}

class MidiWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.arrayOfFreqs = [];
    this.note = 0;
    this.freq = 0;
    this.velocity = 0;
    this.modWheel = 0;
    this.pitchBend = 0;
    this.controlChanges = {};
    this.pads = {};
    this.port.onmessage = (e) => {
      if (e.data.type == "note") {
        if (e.data.velocity == 0) {
          if (this.note == e.data.note) {
            this.note = 0;
            this.velocity = 0;
          }
        } else {
          if (e.data.note != this.note) {
            this.velocity = 0;
            this.rememberVelocity = e.data.velocity;
          }
          this.note = e.data.note;
          this.freq = this.midi2Freq(e.data.note);
        }
      } else if (e.data.type == "modWheel") {
        this.modWheel = e.data.velocity;
      } else if (e.data.type == "pitchBend") {
        this.pitchBend = e.data.velocity;
      } else if (e.data.type == "controlChange") {
        this.controlChanges[e.data.numOfOutput] = e.data.velocity;
        //I SEND IT BACK TO THE COMPONENT BC I WANNA SAVE THIS VALUES, SO THE NEXT TIME YOU LOAD THE SAME PATCH
        //THE CONTROLS OF THIS MIDI INTERFASE WILL START AT THE SAME VALUES
        this.port.postMessage({
          type: "controlChangesToBeSaved",
          controlChanges: this.controlChanges,
        });
      } else if (e.data.type == "pad") {
        this.controlChanges[e.data.numOfOutput] = e.data.velocity;
      } else if (e.data.type == "notesOn") {
        this.makeMidiFreqArrayNotChange(e.data.notesOn);
      }
    };
  }
  makeMidiFreqArrayNotChange(notesOn) {
    this.notesOn = notesOn;
    let keys = Object.keys(this.notesOn);
    let newArrOfKeys = keys.map((k) => this.midi2Freq(k));
    this.arrayOfFreqs = rearrangeArrays(newArrOfKeys, this.arrayOfFreqs);
  }
  midi2Freq(midiNote) {
    return Math.pow(2, (midiNote - 69) / 12) * 440;
  }

  process(inputs, outputs) {
    try {
      let noteOutput1 = ((outputs || [])[0] || [])[0];
      let noteOutput2 = ((outputs || [])[1] || [])[0];
      let noteOutput3 = ((outputs || [])[2] || [])[0];
      let noteOutput4 = ((outputs || [])[3] || [])[0];
      let velOutput = ((outputs || [])[4] || [])[0];
      let modWheelOutput = ((outputs || [])[5] || [])[0];
      let pitchBendOutput = ((outputs || [])[6] || [])[0];

      for (let i = 0; i < velOutput.length; ++i) {
        noteOutput1[i] = this.arrayOfFreqs[0] || 0;
        noteOutput2[i] = this.arrayOfFreqs[1] || 0;
        noteOutput3[i] = this.arrayOfFreqs[2] || 0;
        noteOutput4[i] = this.arrayOfFreqs[3] || 0;
        //
        velOutput[i] = this.velocity;
        modWheelOutput[i] = this.modWheel;
        pitchBendOutput[i] = this.pitchBend;
      }

      //CONTROL CHANGES:
      for (let i = 7; i < outputs.length; ++i) {
        let output = outputs[i][0];
        for (let j = 0; j < output.length; j++) {
          output[j] = this.controlChanges[i];
        }
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
