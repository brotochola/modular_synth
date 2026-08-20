class Shader extends Component {
  static name = "Shader";
  static WIDTH = 640;
  static HEIGHT = 360;
  static VERT = [
    "attribute vec2 a_pos;",
    "void main() {",
    "  gl_Position = vec4(a_pos, 0.0, 1.0);",
    "}",
  ].join("\n");
  static DEFAULT_FS = [
    "precision mediump float;",
    "uniform vec2 u_res;",
    "uniform float u_time;",
    "uniform float x1, x2, x3, x4;",
    "uniform sampler2D u_cam;",
    "uniform float u_hasCam;",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / u_res;",
    "  vec3 synth = vec3(",
    "    sin(uv.x * (10.0 + x1 * 40.0) + u_time),",
    "    sin(uv.y * (10.0 + x2 * 40.0) + u_time * 1.2),",
    "    sin((uv.x + uv.y) * (8.0 + x3 * 30.0))",
    "  ) * 0.5 + 0.5;",
    "  vec3 cam = texture2D(u_cam, uv).rgb;",
    "  vec3 col = mix(synth, cam, u_hasCam * clamp(0.5 + 0.5 * x4, 0.0, 1.0));",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "GPU image synth. Fragment shader runs every video frame. Uniforms: u_res, u_time, x1…x4 (CV from the rack), u_cam, u_hasCam. Spatial oscillators belong in GLSL (sin(uv.x * x1)). Jacks are control-rate: LFO, ADSR, Mouse, Constant. An audio-rate osc into a uniform flickers the whole frame. Cam is a texture, not pixels through audio.";
    this.shader = serializedData?.shader || Shader.DEFAULT_FS;
    this.valuesToSave = ["shader"];
    this.uniforms = { x1: 0, x2: 0, x3: 0, x4: 0 };
    this.hasCam = 0;
    this.running = true;
    this.createCanvas();
    this.createInputText();
    this.createCamToggle();
    this.createButtonToToggleFullscreen();
    this.createNode();
    this.draw();
  }

  getParamInputLimits(name) {
    if (name == "x1" || name == "x2" || name == "x3" || name == "x4") {
      return { min: -1e6, max: 1e6, step: 0.01 };
    }
    return super.getParamInputLimits(name);
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Shader.WIDTH;
    this.canvas.height = Shader.HEIGHT;
    this.canvas.classList.add("shaderCanvas");
    (this.main || this.container).appendChild(this.canvas);

    this.errorBox = document.createElement("pre");
    this.errorBox.classList.add("shaderError");
    (this.main || this.container).appendChild(this.errorBox);

    this.gl = this.canvas.getContext("webgl");
    if (!this.gl) {
      this.showError("WebGL not available");
      return;
    }

    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      this.gl.STATIC_DRAW
    );

    this.camTex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.camTex);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this.vertShader = this.compileShader(this.gl.VERTEX_SHADER, Shader.VERT);
    this.compileProgram(this.shader);
  }

  compileShader(type, src) {
    let sh = this.gl.createShader(type);
    this.gl.shaderSource(sh, src);
    this.gl.compileShader(sh);
    if (!this.gl.getShaderParameter(sh, this.gl.COMPILE_STATUS)) {
      let log = this.gl.getShaderInfoLog(sh);
      this.gl.deleteShader(sh);
      this.showError(log);
      return null;
    }
    return sh;
  }

  compileProgram(src) {
    if (!this.gl || !this.vertShader) return false;
    let fs = this.compileShader(this.gl.FRAGMENT_SHADER, src);
    if (!fs) return false;
    let prog = this.gl.createProgram();
    this.gl.attachShader(prog, this.vertShader);
    this.gl.attachShader(prog, fs);
    this.gl.linkProgram(prog);
    this.gl.deleteShader(fs);
    if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
      this.showError(this.gl.getProgramInfoLog(prog));
      this.gl.deleteProgram(prog);
      return false;
    }
    if (this.program) this.gl.deleteProgram(this.program);
    this.program = prog;
    this.locs = {
      a_pos: this.gl.getAttribLocation(prog, "a_pos"),
      u_res: this.gl.getUniformLocation(prog, "u_res"),
      u_time: this.gl.getUniformLocation(prog, "u_time"),
      x1: this.gl.getUniformLocation(prog, "x1"),
      x2: this.gl.getUniformLocation(prog, "x2"),
      x3: this.gl.getUniformLocation(prog, "x3"),
      x4: this.gl.getUniformLocation(prog, "x4"),
      u_cam: this.gl.getUniformLocation(prog, "u_cam"),
      u_hasCam: this.gl.getUniformLocation(prog, "u_hasCam"),
    };
    this.showError("");
    return true;
  }

  showError(msg) {
    if (!this.errorBox) return;
    this.errorBox.textContent = msg || "";
    this.errorBox.style.display = msg ? "block" : "none";
  }

  createInputText() {
    this.inputText = document.createElement("textarea");
    this.inputText.spellcheck = false;
    this.inputText.value = this.shader;
    this.inputText.onchange = (e) => this.handleInputChange(e);
    this.inputText.onclick = (e) => {
      if (this.active) this.toggleActive();
    };
    (this.main || this.container).appendChild(this.inputText);
  }

  handleInputChange(e) {
    e.preventDefault();
    this.shader = this.inputText.value;
    this.compileProgram(this.shader);
    this.quickSave();
  }

  createCamToggle() {
    this.camLabel = document.createElement("label");
    this.camLabel.classList.add("camToggle");
    this.camCheck = document.createElement("input");
    this.camCheck.type = "checkbox";
    this.camCheck.onchange = () => this.toggleCam(this.camCheck.checked);
    this.camLabel.appendChild(this.camCheck);
    this.camLabel.appendChild(document.createTextNode(" cam"));
    (this.main || this.container).appendChild(this.camLabel);
  }

  toggleCam(on) {
    if (on) this.startCam();
    else this.stopCam();
  }

  startCam() {
    if (this.camStream) return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!this.running) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.camStream = stream;
        this.video = document.createElement("video");
        this.video.playsInline = true;
        this.video.muted = true;
        this.video.autoplay = true;
        this.video.srcObject = stream;
        this.video.play();
        this.hasCam = 1;
      })
      .catch((err) => {
        this.camCheck.checked = false;
        this.showError(String(err));
      });
  }

  stopCam() {
    this.hasCam = 0;
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  createButtonToToggleFullscreen() {
    this.toggle = document.createElement("button");
    this.toggle.classList.add("togglefullscreen");
    this.toggle.innerHTML = "Toggle Fullscreen";
    this.toggle.onclick = () => {
      if (this.canvas.parentNode == this.app.container) {
        (this.main || this.container).append(this.canvas);
      } else {
        this.app.container.append(this.canvas);
      }
    };
    (this.main || this.container).appendChild(this.toggle);
  }

  createNode() {
    this.app.loadWorklet("js/audioWorklets/shaderUniformsWorklet.js").then(() => {
      this.node = new AudioWorkletNode(this.app.actx, "shader-uniforms-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        parameterData: { x1: 0, x2: 0, x3: 0, x4: 0 },
      });
      this.node.onprocessorerror = (e) => {
        console.error(e);
      };
      this.node.port.onmessage = (e) => {
        this.uniforms.x1 = e.data.x1;
        this.uniforms.x2 = e.data.x2;
        this.uniforms.x3 = e.data.x3;
        this.uniforms.x4 = e.data.x4;
      };
      // ponytail: 0-output worklet is not pulled. Silent tap keeps process() running.
      this.silentGain = this.app.actx.createGain();
      this.silentGain.gain.value = 0;
      this.node.connect(this.silentGain);
      this.silentGain.connect(this.app.actx.destination);
    });
  }

  uploadCamTexture() {
    if (!this.gl || !this.video || this.video.readyState < 2) return;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.camTex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.video
    );
  }

  draw() {
    if (!this.running) return;
    requestAnimationFrame(() => this.draw());
    let gl = this.gl;
    if (!gl || !this.program) return;

    this.uploadCamTexture();

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.locs.a_pos);
    gl.vertexAttribPointer(this.locs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.locs.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locs.u_time, this.app.actx.currentTime);
    gl.uniform1f(this.locs.x1, this.uniforms.x1);
    gl.uniform1f(this.locs.x2, this.uniforms.x2);
    gl.uniform1f(this.locs.x3, this.uniforms.x3);
    gl.uniform1f(this.locs.x4, this.uniforms.x4);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.camTex);
    gl.uniform1i(this.locs.u_cam, 0);
    gl.uniform1f(this.locs.u_hasCam, this.hasCam);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  updateUI() {
    if (this.inputText) this.inputText.value = this.shader;
    this.compileProgram(this.shader);
  }

  remove() {
    this.running = false;
    this.stopCam();
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch (e) {}
    }
    if (this.node) {
      try {
        this.node.disconnect();
      } catch (e) {}
    }
    if (this.gl) {
      let lose = this.gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      this.gl = null;
    }
    super.remove();
  }
}
