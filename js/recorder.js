class Recorder extends Component {
  static name = "Recorder";
  static BEATS = [4, 8, 16];
  static PEAK_COLS = 128;

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Audio Recorder — beat-synced loop buffer.\n\n" +
      "• audio: signal to record\n" +
      "• gate: while >= 1, records (0/1)\n" +
      "• toggleRec: rising edge flips record latch\n" +
      "• play / clear: triggers (also buttons)\n" +
      "• Length: 4 / 8 / 16 beats at project BPM. Resize copies audio; shrink truncates, grow pads silence.\n" +
      "• playbackRate + currentTime (seek play + record). Click waveform to seek. Record writes from that position.\n" +
      "• loop / thru checkboxes.";
    this.namedAudioInputs = ["audio", "gate"];
    this.uiParamWidgets = { in_0: "none", in_1: "none" };
    this.customAudioTriggers = ["toggleRec", "play", "clear"];
    this.jackKinds = {
      audio: "audio",
      gate: "gate",
      toggleRec: "trig",
      play: "trig",
      clear: "trig",
    };
    this.valuesToSave = ["beats", "loop", "thru"];
    this.beats =
      serializedData && Recorder.BEATS.includes(Number(serializedData.beats))
        ? Number(serializedData.beats)
        : 8;
    this.loop =
      serializedData && serializedData.loop !== undefined
        ? !!serializedData.loop
        : true;
    this.thru =
      serializedData && serializedData.thru !== undefined
        ? !!serializedData.thru
        : true;
    this.peaks = new Float32Array(Recorder.PEAK_COLS * 2);
    this.playHeadNorm = 0;
    this.writeHeadNorm = 0;
    this.recording = false;
    this.playing = false;
    this.durationSec = 0;
    this.width = 280;
    this.height = 80;
    this.createCanvas();
    this.createControls();
    this.createNode();
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.classList.add("recorderCanvas");
    this.canvas.title = "Click to seek";
    this.canvas.onclick = (e) => this.onCanvasClick(e);
    (this.main || this.container).appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.drawWaveform();
  }

  createControls() {
    this.controls = document.createElement("div");
    this.controls.classList.add("recorderControls");

    this.recBtn = document.createElement("button");
    this.recBtn.classList.add("recorderRecBtn");
    this.recBtn.textContent = "REC";
    this.recBtn.title = "Toggle record latch (same as toggleRec trigger)";
    this.recBtn.onclick = () => this.postToWorklet({ toggleRec: true });

    this.playBtn = document.createElement("button");
    this.playBtn.classList.add("recorderPlayBtn");
    this.playBtn.textContent = "PLAY";
    this.playBtn.title = "Toggle playback (same as play trigger)";
    this.playBtn.onclick = () => this.postToWorklet({ play: true });

    this.clearBtn = document.createElement("button");
    this.clearBtn.classList.add("recorderClearBtn");
    this.clearBtn.textContent = "CLR";
    this.clearBtn.title = "Clear buffer (same as clear trigger)";
    this.clearBtn.onclick = () => this.postToWorklet({ clear: true });

    this.beatsSelect = document.createElement("select");
    this.beatsSelect.classList.add("recorderBeatsSelect", "ui-select");
    this.beatsSelect.title =
      "Buffer length in beats at project BPM (resize copies audio)";
    for (let b of Recorder.BEATS) {
      let opt = document.createElement("option");
      opt.value = String(b);
      opt.textContent = b + " beats";
      this.beatsSelect.appendChild(opt);
    }
    this.beatsSelect.value = String(this.beats);
    this.beatsSelect.onchange = () => {
      this.beats = Number(this.beatsSelect.value);
      this.sendBpmBeats();
      this.updateDurationLabel();
      this.quickSave();
    };

    this.toggleWrap = document.createElement("div");
    this.toggleWrap.classList.add("moduleToggles");

    this.loopLabel = document.createElement("label");
    this.loopLabel.title = "Loop playback when playhead reaches end";
    this.loopCheck = document.createElement("input");
    this.loopCheck.type = "checkbox";
    this.loopCheck.checked = !!this.loop;
    this.loopCheck.onchange = () => {
      this.loop = this.loopCheck.checked;
      this.postToWorklet({ loop: this.loop });
      this.quickSave();
    };
    this.loopLabel.appendChild(this.loopCheck);
    this.loopLabel.appendChild(document.createTextNode(" loop"));

    this.thruLabel = document.createElement("label");
    this.thruLabel.title = "Mix dry input to output";
    this.thruCheck = document.createElement("input");
    this.thruCheck.type = "checkbox";
    this.thruCheck.checked = !!this.thru;
    this.thruCheck.onchange = () => {
      this.thru = this.thruCheck.checked;
      this.postToWorklet({ thru: this.thru });
      this.quickSave();
    };
    this.thruLabel.appendChild(this.thruCheck);
    this.thruLabel.appendChild(document.createTextNode(" thru"));

    this.toggleWrap.appendChild(this.loopLabel);
    this.toggleWrap.appendChild(this.thruLabel);

    this.durationLabel = document.createElement("div");
    this.durationLabel.classList.add("recorderDuration");

    this.controls.appendChild(this.recBtn);
    this.controls.appendChild(this.playBtn);
    this.controls.appendChild(this.clearBtn);
    this.controls.appendChild(this.beatsSelect);
    (this.main || this.container).appendChild(this.controls);
    (this.main || this.container).appendChild(this.toggleWrap);
    (this.main || this.container).appendChild(this.durationLabel);
    this.updateDurationLabel();
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/recorderWorklet.js").then(() => {
      this.node = this.makeWorklet("recorder-worklet", {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        parameterData: { playbackRate: 1, currentTime: 0 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.postToWorklet({ loop: this.loop, thru: this.thru });
      this.sendBpmBeats();
    });
  }

  postToWorklet(msg) {
    if (this.node && this.node.port) this.node.port.postMessage(msg);
  }

  sendBpmBeats() {
    this.postToWorklet({
      bpm: this.app.bpm || 120,
      beats: this.beats,
    });
  }

  updateBPM() {
    this.sendBpmBeats();
    this.updateDurationLabel();
  }

  updateDurationLabel() {
    let bpm = this.app.bpm || 120;
    let sec = this.beats * (60 / bpm);
    this.durationSec = sec;
    if (this.durationLabel) {
      this.durationLabel.textContent =
        sec.toFixed(2) + "s @ " + this.beats + " beats / " + bpm + " BPM";
    }
  }

  handleTriggerFromWorklet(e) {
    if (e.current == 0) return;
    let ch = e.channelTriggered;
    if (ch === 0) this.postToWorklet({ toggleRec: true });
    else if (ch === 1) this.postToWorklet({ play: true });
    else if (ch === 2) this.postToWorklet({ clear: true });
  }

  getParamInputLimits(name) {
    if (name == "playbackRate") return { min: 0.25, max: 4, step: 0.01 };
    if (name == "currentTime") {
      let max = this.durationSec > 0 ? this.durationSec : 60;
      return { min: 0, max: max, step: 0.001 };
    }
    return super.getParamInputLimits(name);
  }

  onCanvasClick(e) {
    let rect = this.canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    this.playHeadNorm = x;
    this.writeHeadNorm = x;
    this.postToWorklet({ seekNorm: x });
    let p =
      this.node && this.node.parameters && this.node.parameters.get("currentTime");
    if (p) p.value = x * (this.durationSec || 0);
    this.drawWaveform();
  }

  onSabTick() {
    super.onSabTick();
    let sab = this.sabBlock;
    if (!sab) return;
    let bits = sab.getRec();
    this.playHeadNorm = sab.getSlot(0);
    this.writeHeadNorm = sab.getSlot(1);
    this.recording = !!(bits & AppConfig.SAB_REC_RECORDING);
    this.playing = !!(bits & AppConfig.SAB_REC_PLAYING);
    let dur = sab.getSlot(5);
    if (dur > 0) this.durationSec = dur;
    let note = sab.getNote();
    if (note !== this._peakNote) {
      this._peakNote = note;
      let cols = Recorder.PEAK_COLS;
      let n = cols * 2;
      if (!this.peaks || this.peaks.length !== n) this.peaks = new Float32Array(n);
      let base = AppConfig.SAB_RING_BASE;
      for (let i = 0; i < n; i++) this.peaks[i] = sab.f32[base + i];
    }
    this.updateButtons();
    this.drawWaveform();
  }

  updateButtons() {
    if (this.recBtn) {
      this.recBtn.classList.toggle("active", !!this.recording);
    }
    if (this.playBtn) {
      this.playBtn.classList.toggle("active", !!this.playing);
      this.playBtn.textContent = this.playing ? "STOP" : "PLAY";
    }
  }

  drawWaveform() {
    if (!this.ctx) return;
    let w = this.width;
    let h = this.height;
    let mid = h / 2;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, w, h);
    let cols = Recorder.PEAK_COLS;
    let peaks = this.peaks;
    if (peaks && peaks.length >= cols * 2) {
      this.ctx.strokeStyle = "#8cf";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        let mn = peaks[c * 2];
        let mx = peaks[c * 2 + 1];
        let x = (c / cols) * w;
        let y0 = mid - mx * mid;
        let y1 = mid - mn * mid;
        this.ctx.moveTo(x, y0);
        this.ctx.lineTo(x, y1);
      }
      this.ctx.stroke();
    }
    this.ctx.strokeStyle = "#0f0";
    this.ctx.beginPath();
    this.ctx.moveTo(0, mid);
    this.ctx.lineTo(w, mid);
    this.ctx.stroke();
    this.ctx.lineWidth = 1.5;
    if (this.playing) {
      let px = this.playHeadNorm * w;
      this.ctx.strokeStyle = "#fff";
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, h);
      this.ctx.stroke();
    }
    if (this.recording) {
      let wx = this.writeHeadNorm * w;
      this.ctx.strokeStyle = "#f44";
      this.ctx.beginPath();
      this.ctx.moveTo(wx, 0);
      this.ctx.lineTo(wx, h);
      this.ctx.stroke();
    } else if (!this.playing) {
      let px = this.playHeadNorm * w;
      this.ctx.strokeStyle = "#fff";
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, h);
      this.ctx.stroke();
    }
  }

  putLabels() {
    super.putLabels();
    if (this.beatsSelect) this.beatsSelect.value = String(this.beats);
    if (this.loopCheck) this.loopCheck.checked = !!this.loop;
    if (this.thruCheck) this.thruCheck.checked = !!this.thru;
    this.updateDurationLabel();
    this.postToWorklet({ loop: this.loop, thru: this.thru });
    this.sendBpmBeats();
  }
}

// ponytail: resize + BPM length self-check. Upgrade = formal test if API grows.
(function recorderSelfCheck() {
  function resizeBuffer(old, newLen) {
    let next = new Float32Array(newLen);
    next.set(old.subarray(0, Math.min(old.length, newLen)));
    return next;
  }
  function bufferLen(beats, bpm, sr) {
    return Math.max(1, Math.floor(beats * (60 / bpm) * sr));
  }
  let sr = 48000;
  let len4 = bufferLen(4, 120, sr);
  let len8 = bufferLen(8, 120, sr);
  let len16 = bufferLen(16, 120, sr);
  if (len4 !== 96000 || len8 !== 192000 || len16 !== 384000) {
    console.error("recorder length self-check fail", len4, len8, len16);
  }
  let big = new Float32Array(16);
  for (let i = 0; i < 16; i++) big[i] = i + 1;
  let shrink = resizeBuffer(big, 8);
  if (shrink.length !== 8 || shrink[7] !== 8 || shrink[0] !== 1) {
    console.error("recorder shrink self-check fail", shrink);
  }
  let grow = resizeBuffer(shrink, 16);
  if (grow.length !== 16 || grow[7] !== 8 || grow[8] !== 0 || grow[15] !== 0) {
    console.error("recorder grow self-check fail", grow);
  }
})();
