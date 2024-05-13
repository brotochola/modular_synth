class Midi extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "If you have a midi device connected, this module outputs note on/off messages as frequency and velocity values, modulation wheel, and pitch bend.. for now";
    if (navigator.requestMIDIAccess) {
      navigator
        .requestMIDIAccess({
          sysex: false,
        })
        .then(
          (e) => this.onMIDISuccess(e),
          (e) => this.onMIDIFailure(e)
        );
    } else {
      console.warn("No MIDI support in your browser");
    }
    this.createDisplay();
    this.createNode();
    this.outputLabels = ["freq", "velocity", "mod wheel", "pitch bend"];
  }
  createDisplay() {
    this.display = document.createElement("div");
    this.display.classList.add("display");
    this.container.appendChild(this.display);
  }
  // on success
  onMIDISuccess(midiData) {
    // this is all our MIDI data
    this.midi = midiData;
    var allInputs = this.midi.inputs.values();

    // loop over all available inputs and listen for any MIDI input
    for (
      var input = allInputs.next();
      input && !input.done;
      input = allInputs.next()
    ) {
      // when a MIDI value is received call the onMIDIMessage function
      // console.log(input)
      this.device = input;
      this.display.innerText = input.value.name;
      input.value.onmidimessage = (e) => this.gotMIDImessage(e);
    }
  }

  gotMIDImessage(messageData) {
    handleMidiMessage(
      messageData,
      this.onNote.bind(this),
      this.onPad.bind(this),
      this.onModWheel.bind(this),
      this.onPitchBend.bind(this)
    );
  }
  onPad(note, velocity) {
    // this.node.port.postMessage({type:"pad",note,velocity})
  }
  onModWheel(velocity) {
    this.node.port.postMessage({ type: "modWheel", velocity });
  }
  onPitchBend(velocity) {
    this.node.port.postMessage({ type: "pitchBend", velocity });
  }
  onNote(note, velocity) {
    console.log("onNote", note, velocity);
    this.node.port.postMessage({ type: "note", note, velocity });
  }

  // on failure
  onMIDIFailure() {
    console.warn("Not recognising MIDI controller");
  }

  createNode() {
    this.app.actx.audioWorklet
      .addModule("js/audioWorklets/midiWorklet.js")
      .then(() => {
        this.node = new AudioWorkletNode(this.app.actx, "midi-worklet", {
          numberOfInputs: 0,
          numberOfOutputs: 4,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => console.log("#msg", e.data);
        // setTimeout(() => this.putLabels(), 200);
      });
  }
  //   putLabels() {
  //     this.outputElements = Array.from(
  //       this.container.querySelectorAll(".outputButton")
  //     );

  //     for (let i = 0; i < this.outputElements.length; i++) {
  //       let elem = this.outputElements[i];
  //       //   console.log(elem, i, this.letters[i]);
  //       elem.style.setProperty("--letter", "'" + (i + 1) + "'");
  //     }
  //   }
}
