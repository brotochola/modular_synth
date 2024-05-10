class WaveShaper extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);
    this.length = 32;

    this.real = new Float32Array(this.length);
    // this.imag = new Float32Array(0);

    this.node = this.app.actx.createOscillator();

    for (let i = 0; i < this.length; i++) {
      this.real[i] = 1 / (i + 1) ** 2;
    }

    // this.real[4] = 0.5;
    // this.imag[1] = 0;

    this.wave = this.app.actx.createPeriodicWave(
      this.real,
      new Float32Array(this.length),
      {
        disableNormalization: false,
      }
    );

    this.node.setPeriodicWave(this.wave);

    this.node.start();

    // this.createInputButtons();
  }
}
