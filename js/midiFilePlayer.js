class MidiFilePlayer extends Component {
  static name = "MIDI Player";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "MIDI file player. Load a .mid; each MIDI channel with notes gets a note (Hz) + trigger pair. If only one channel but many tracks, splits by track. Play via button or rising trigger; stop input ends playback. Rate scales tempo.";
    this.playing = false;
    this.voices = [{ id: "ch1", label: "ch1" }];
    this.namedAudioInputs = ["trigger", "stop"];
    this.uiParamWidgets = { in_0: "none", in_1: "none" };
    this.valuesToSave = ["audioEncoding", "base64", "filename", "voiceLabels"];
    this.outputLabels = ["ch1 note", "ch1 trig"];

    this.createInputFile();
    this.createPlayButton();
    this.createNode(2);
  }

  createPlayButton() {
    this.playButton = document.createElement("button");
    this.playButton.style.display = "none";
    this.playButton.classList.add("playButton");
    (this.main || this.container).appendChild(this.playButton);
    this.playButton.onclick = () => this.playPause();
  }

  parseMidiVoices(player) {
    let tracks = player.getEvents() || [];
    let channelNotes = new Set();
    let trackNotes = new Set();
    let channelProgram = {};
    let channelTrackName = {};
    let trackNames = {};
    let trackInstruments = {};
    let raw = [];

    for (let ti = 0; ti < tracks.length; ti++) {
      let track = tracks[ti] || [];
      for (let ev of track) {
        if (ev.name == "Sequence/Track Name" && ev.string) {
          trackNames[ti] = String(ev.string).trim();
        } else if (ev.name == "Instrument Name" && ev.string) {
          trackInstruments[ti] = String(ev.string).trim();
        } else if (ev.name == "Program Change" && ev.channel != null) {
          channelProgram[ev.channel] = ev.value;
        }

        let isOn = ev.name == "Note on" && ev.velocity > 0;
        let isOff =
          ev.name == "Note off" || (ev.name == "Note on" && !(ev.velocity > 0));
        if (!isOn && !isOff) continue;

        let ch = ev.channel != null ? ev.channel : 1;
        channelNotes.add(ch);
        trackNotes.add(ti);
        if (trackNames[ti] && !channelTrackName[ch]) {
          channelTrackName[ch] = trackNames[ti];
        }
        if (trackInstruments[ti] && !channelTrackName[ch]) {
          channelTrackName[ch] = trackInstruments[ti];
        }
        raw.push({
          tick: ev.tick || 0,
          type: isOn ? 1 : 0,
          note: ev.noteNumber,
          channel: ch,
          track: ti,
        });
      }
    }

    let byChannel = channelNotes.size > 1;
    let byTrack = !byChannel && trackNotes.size > 1;
    let voices = [];
    let keyToVoice = {};

    let usableName = (s) => {
      if (!s) return null;
      let t = String(s).trim();
      if (!t || /^untitled$/i.test(t)) return null;
      return t.length > 14 ? t.slice(0, 14) : t;
    };

    if (byTrack) {
      let keys = Array.from(trackNotes).sort((a, b) => a - b);
      for (let ti of keys) {
        let label =
          usableName(trackInstruments[ti]) ||
          usableName(trackNames[ti]) ||
          "t" + (ti + 1);
        keyToVoice["t" + ti] = voices.length;
        voices.push({ id: "t" + ti, label, track: ti });
      }
    } else {
      let keys = Array.from(channelNotes).sort((a, b) => a - b);
      if (keys.length == 0) keys = [1];
      for (let ch of keys) {
        let label =
          usableName(channelTrackName[ch]) ||
          (channelProgram[ch] != null ? "p" + channelProgram[ch] : null) ||
          "ch" + ch;
        keyToVoice["c" + ch] = voices.length;
        voices.push({ id: "c" + ch, label, channel: ch });
      }
    }

    let events = [];
    for (let r of raw) {
      let key = byTrack ? "t" + r.track : "c" + r.channel;
      let voice = keyToVoice[key];
      if (voice == null) continue;
      events.push({
        tick: r.tick,
        type: r.type,
        note: r.note,
        voice,
      });
    }
    events.sort((a, b) => a.tick - b.tick || a.type - b.type);

    return { voices, events, mode: byTrack ? "track" : "channel" };
  }

  rebuildOutputsUI() {
    if (this.outputs && this.outputs.parentNode) {
      this.outputs.parentNode.removeChild(this.outputs);
    }
    this.outputs = document.createElement("outputs");
    (this.body || this.container).appendChild(this.outputs);
    let n = (this.node || {}).numberOfOutputs || 0;
    for (let i = 0; i < n; i++) {
      let outputButton = document.createElement("input");
      outputButton.type = "checkbox";
      outputButton.classList.add("outputButton");
      outputButton.setAttribute("numberOfOutput", i);
      outputButton.onclick = (e) => this.onOutputClicked(e, outputButton);
      this.outputs.appendChild(outputButton);
    }
    this.outputElements = null;
    this.outputLabels = [];
    for (let v of this.voices || []) {
      this.outputLabels.push(v.label + " note");
      this.outputLabels.push(v.label + " trig");
    }
    if (!this.outputLabels.length) {
      this.outputLabels = ["note", "trigger"];
    }
    this.voiceLabels = (this.voices || []).map((v) => v.label);
    this.putLabels();
  }

  ensureWorkletModule() {
    return this.app.loadWorklet("js/audioWorklets/midiPlayerWorklet.js");
  }

  createNode(numOutputs) {
    let outs = Math.max(2, numOutputs || 2);
    let epoch = (this._nodeEpoch = (this._nodeEpoch || 0) + 1);
    this.ensureWorkletModule().then(() => {
      if (epoch !== this._nodeEpoch) return;
      // Load path owns node size once a file is present
      if (this.arrayBuffer && this.node) {
        this.postLoadToWorklet();
        return;
      }
      let rate = 1;
      try {
        if (this.node?.parameters?.get("rate")) {
          rate = this.node.parameters.get("rate").value;
        }
      } catch (e) {}
      if (this.node) {
        try {
          this.node.disconnect();
        } catch (e) {}
      }
      this.node = new AudioWorkletNode(this.app.actx, "midi-player-worklet", {
        numberOfInputs: 2,
        numberOfOutputs: outs,
        parameterData: { rate },
      });
      this.node.onprocessorerror = (e) => console.error(e);
      this.node.port.onmessage = (e) => {
        if (e.data && e.data.ended) {
          this.playing = false;
          this.updateButton();
        }
      };
      if (this.arrayBuffer) this.postLoadToWorklet();
    });
  }

  createOutputButton() {
    this.rebuildOutputsUI();
  }

  postLoadToWorklet() {
    if (!this.arrayBuffer) return;
    let player = new MidiPlayer.Player(() => {});
    player.loadArrayBuffer(this.arrayBuffer);
    let parsed = this.parseMidiVoices(player);
    this.voices = parsed.voices;
    this.ppqn = player.division || 480;
    let needOuts = Math.max(2, this.voices.length * 2);

    let finish = () => {
      if (!this.node?.port) return;
      this.node.port.postMessage({
        type: "load",
        events: parsed.events,
        voices: this.voices.length,
        ppqn: this.ppqn,
        bpm: this.app.bpm || 120,
      });
      this.rebuildOutputsUI();
    };

    if (!this.node || this.node.numberOfOutputs != needOuts) {
      this.app.removeAllConnections(this);
      let epoch = (this._nodeEpoch = (this._nodeEpoch || 0) + 1);
      this.ensureWorkletModule().then(() => {
        if (epoch !== this._nodeEpoch) return;
        let rate = 1;
        try {
          rate = this.node?.parameters?.get("rate")?.value ?? 1;
        } catch (e) {}
        if (this.node) {
          try {
            this.node.disconnect();
          } catch (e) {}
        }
        this.node = new AudioWorkletNode(this.app.actx, "midi-player-worklet", {
          numberOfInputs: 2,
          numberOfOutputs: needOuts,
          parameterData: { rate },
        });
        this.node.onprocessorerror = (e) => console.error(e);
        this.node.port.onmessage = (e) => {
          if (e.data && e.data.ended) {
            this.playing = false;
            this.updateButton();
          }
        };
        finish();
        this.app.resetAllConnections();
      });
      return;
    }
    finish();
    this.app.resetAllConnections();
  }

  play() {
    if (!this.arrayBuffer || !this.node?.port) return;
    this.node.port.postMessage({ type: "play" });
    this.playing = true;
    this.updateButton();
  }

  stop() {
    if (!this.node?.port) return;
    this.node.port.postMessage({ type: "stop" });
    this.playing = false;
    this.updateButton();
  }

  playPause() {
    if (!this.arrayBuffer) return;
    if (this.playing) this.stop();
    else this.play();
  }

  updateBPM() {
    if (!this.node?.port) return;
    this.node.port.postMessage({ type: "setBpm", bpm: this.app.bpm || 120 });
  }

  updateButton() {
    let name = this.filename || "MIDI";
    let n = (this.voices || []).length;
    let suffix = n > 1 ? " (" + n + " voices)" : "";
    this.playButton.textContent = !this.playing
      ? "▶️ " + name + suffix
      : "⏹️ " + name + suffix;
  }

  createInputFile() {
    this.inputFile = document.createElement("input");
    this.inputFile.setAttribute("type", "file");
    this.inputFile.accept = ".mid,.midi,audio/midi,audio/x-midi";
    this.inputFile.onchange = () => this.handleOnChange();
    (this.main || this.container).appendChild(this.inputFile);

    this.buttonToTriggerInputFile = document.createElement("button");
    this.buttonToTriggerInputFile.innerHTML = "Choose file...";
    this.buttonToTriggerInputFile.classList.add("triggerInputFile");
    this.buttonToTriggerInputFile.onclick = () => this.inputFile.click();
    (this.main || this.container).appendChild(this.buttonToTriggerInputFile);
  }

  loadMidiFromBuffer(buf) {
    this.arrayBuffer = copyArrayBuffer(buf);
    this.playing = false;
    this.playButton.style.display = "block";
    if (this.buttonToTriggerInputFile) {
      this.buttonToTriggerInputFile.style.display = "none";
    }
    this.postLoadToWorklet();
    this.updateButton();
  }

  handleOnChange() {
    if (!(this.inputFile.files || [])[0] && !this.arrayBuffer) {
      return console.warn("no file selected or no midi buffer loaded");
    }
    this.playing = false;
    this.playButton.style.display = "block";
    if (this.buttonToTriggerInputFile) {
      this.buttonToTriggerInputFile.style.display = "none";
    }

    if (this.arrayBuffer && this.currentAudioFile == this.inputFile.files[0]) {
      this.loadMidiFromBuffer(this.arrayBuffer);
      return;
    }

    if (!(this.inputFile.files || [])[0]) {
      if (this.arrayBuffer) this.loadMidiFromBuffer(this.arrayBuffer);
      return;
    }

    let file = this.inputFile.files[0];
    let reader = new FileReader();
    reader.onload = async () => {
      let raw = reader.result;
      this.filename = file.name;
      let saved = await saveBinaryAsset(
        this.app.patchName,
        this.filename,
        raw,
        { gzip: true },
      );
      this.base64 = saved.base64;
      this.audioEncoding = saved.audioEncoding;
      this.loadMidiFromBuffer(raw);
      this.quickSave();
      this.updateButton();
    };
    reader.readAsArrayBuffer(file);
    this.currentAudioFile = file;
    this.updateButton();
  }

  async updateUI() {
    let loaded = await loadBinaryAsset({
      patchName: this.app.patchName,
      filename: this.filename,
      base64: this.base64,
      audioEncoding: this.audioEncoding,
    });
    if (loaded) {
      this.base64 = loaded.base64;
      this.audioEncoding = loaded.audioEncoding;
      this.loadMidiFromBuffer(loaded.arrayBuffer);
    }
    this.updateButton();
  }
}
