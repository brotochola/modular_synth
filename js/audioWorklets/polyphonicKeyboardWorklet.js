function rearrangeArrays(inputArray, outputArray) {
  let inputSet = new Set(inputArray);
  let resultArray = [];
  let newValues = inputArray.filter((value) => !outputArray.includes(value));

  for (let value of outputArray) {
    if (inputSet.has(value)) {
      resultArray.push(value);
    } else {
      resultArray.push(null);
    }
  }

  let newIndex = 0;
  for (let i = 0; i < resultArray.length; i++) {
    if (resultArray[i] === null && newIndex < newValues.length) {
      resultArray[i] = newValues[newIndex];
      newIndex++;
    }
  }

  while (newIndex < newValues.length) {
    resultArray.push(newValues[newIndex]);
    newIndex++;
  }

  return resultArray;
}

class PolyphonicKeyboardWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.notesOn = {};
    this.arrayOfFreqs = [];
    this.maxVoices = 8;
    this.port.onmessage = (e) => {
      if (e.data.type == "down") {
        let midiNote = e.data.midiNote;
        if (midiNote == null) return;
        this.notesOn[midiNote] = true;
        this.rebuildFreqs();
      } else if (e.data.type == "up") {
        let midiNote = e.data.midiNote;
        if (midiNote == null) return;
        delete this.notesOn[midiNote];
        this.rebuildFreqs();
      } else if (e.data.type == "releaseAll") {
        this.notesOn = {};
        this.rebuildFreqs();
      }
    };
  }

  midi2Freq(midiNote) {
    return Math.pow(2, (midiNote - 69) / 12) * 440;
  }

  rebuildFreqs() {
    let keys = Object.keys(this.notesOn);
    let newArrOfKeys = keys.map((k) => this.midi2Freq(k));
    this.arrayOfFreqs = rearrangeArrays(newArrOfKeys, this.arrayOfFreqs).slice(
      0,
      this.maxVoices
    );
    while (this.arrayOfFreqs.length < this.maxVoices) {
      this.arrayOfFreqs.push(null);
    }
    this.port.postMessage({
      type: "freqs",
      freqs: this.arrayOfFreqs.map((f) => f || 0),
    });
  }

  process(inputs, outputs) {
    let n = 0;
    for (let o = 0; o < outputs.length; o++) {
      let ch = (outputs[o] || [])[0];
      if (ch && ch.length > n) n = ch.length;
    }
    for (let i = 0; i < n; ++i) {
      for (let o = 0; o < outputs.length; o++) {
        let ch = (outputs[o] || [])[0];
        if (!ch) continue;
        ch[i] = this.arrayOfFreqs[o] || 0;
      }
    }
    return true;
  }
}

registerProcessor("polyphonic-keyboard-worklet", PolyphonicKeyboardWorklet);
