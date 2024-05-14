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
    this.visibleOutputs = {
      freq: { numOfOutput: 0 },
      velocity: { numOfOutput: 1 },
      modWheel: { numOfOutput: 2 },
      pitchBend: { numOfOutput: 3 },
    };
    this.valuesToSave = ["visibleOutputs", "controlChangesToBeSaved"];
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
  getOutputElementFromID(id) {
    return outputs[this.visibleOutputs[id].numOfOutput];
  }

  updateUI() {
    console.log("update ui midi input");
    if (!Array.isArray(this.outputsElements)) return;
    let outputs = this.outputsElements;
    let visibleChannels = Object.keys(this.visibleOutputs);
    for (let i = 0; i < outputs.length; i++) {
      //IF THIS OUTPUT CHECKBOX ELEMENT IS ALREADY VISIBLE, DONT BOTHER AND LEAVE IT
      if (outputs[i].style.display == "block") continue;
      let shouldItBeVisible = false;
      let label;
      //SO I CHECK EACH OUTPUT AGAINST EACH OF MY SAVED VISIBLE OUTPUT MIDI CHANNELS/MESSAGES
      for (let j = 0; j < visibleChannels.length; j++) {
        label = visibleChannels[j];
        let channel = this.visibleOutputs[visibleChannels[j]];
        //IF THE NUMBER OF OUTPUT SAVED MATCHES, WE SHOW THIS OUTPUT
        if (channel.numOfOutput == i) {
          shouldItBeVisible = true;
          break;
        }
      }

      if (shouldItBeVisible) {
        outputs[i].style.display = "block";
        outputs[i].style.getPropety;
        outputs[i].style.setProperty("--label", "'" + label + "'");
      } else {
        outputs[i].style.display = "none";
      }
    }

    this.container.style.height = 60 + visibleChannels.length * 16 + "px";

    if ((this.serializedData || {}).controlChangesToBeSaved) {
      let keys = Object.keys(this.serializedData.controlChangesToBeSaved);
      for (let k of keys) {
        this.node.port.postMessage({
          type: "controlChange",
          velocity: this.serializedData.controlChangesToBeSaved[k],
          numOfOutput: k,
        });
      }
      this.serializedData.controlChangesToBeSaved = null;
    }
  }

  gotMIDImessage(messageData) {
    handleMidiMessage(
      messageData,
      this.onNote.bind(this),
      this.onPad.bind(this),
      this.onModWheel.bind(this),
      this.onPitchBend.bind(this),
      this.onControlChange.bind(this)
    );
  }
  addToVisibleOutputs(note) {
    // console.log("addToVisibleOutputs", note);
    if (!this.visibleOutputs[note]) {
      let keys = Object.keys(this.visibleOutputs);
      const numOfOutput = keys.length;
      this.visibleOutputs[note] = {
        numOfOutput,
      };
      // console.log('Added',this.visibleOutputs[note])
      // let outputs = Array.from(
      //   this.container.querySelectorAll(".outputButton")
      // );
      // outputs[numOfOutput].style.setProperty("--label", "'" + note + "'");
      this.updateUI();
      this.app.updateAllLines();
      this.quickSave();
    }
  }
  makeOutputElementFlash(numOfOutput) {
    let elem = (this.outputsElements || {})[numOfOutput];
    if (!elem) return;
    elem.classList.add("active");
    setTimeout(() => elem.classList.remove("active"), 100);
  }
  onControlChange(note, velocity) {
    // console.log("on control change", note, velocity);
    this.addToVisibleOutputs("control_" + note);

    let numOfOutput = (this.visibleOutputs["control_" + note.toString()] || {})
      .numOfOutput;
    if (!numOfOutput) return;
    this.node.port.postMessage({
      type: "controlChange",
      velocity,
      numOfOutput,
    });
    this.makeOutputElementFlash(numOfOutput);
  }
  onPad(note, velocity) {
    // console.log("on pad", note, velocity);
    this.addToVisibleOutputs("pad_" + note);

    let numOfOutput = (this.visibleOutputs["pad_" + note.toString()] || {})
      .numOfOutput;
    if (!numOfOutput) return;
    this.node.port.postMessage({
      type: "pad",
      note,
      velocity,
      numOfOutput,
    });
    this.makeOutputElementFlash(numOfOutput);

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
          numberOfOutputs: 20,
        });

        this.node.onprocessorerror = (e) => {
          console.error(e);
        };

        this.node.port.onmessage = (e) => {
          // console.log("#msg", e.data);
          if (e.data.type == "controlChangesToBeSaved") {
            this.controlChangesToBeSaved = e.data.controlChanges;
          }
        };
        this.waitUntilImReady(() => {
          //WHEN THIS NODE IS READY

          setTimeout(() => {
            this.outputsElements = Array.from(
              this.container.querySelectorAll(".outputButton")
            );
            this.updateUI();
          }, 20);
          // setTimeout(() => this.putLabels(), 200);
        });
      });
  }
}
