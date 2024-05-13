class Midi extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    // start talking to MIDI controller
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
      input.value.onmidimessage = (e) => this.gotMIDImessage(e);
    }
  }

  gotMIDImessage(messageData) {
    console.log(messageData);
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
          numberOfOutputs: 3,
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
