class EnvelopeGenerator extends Component {
  constructor(app, serializedData) {
    super(app, serializedData);

    /* 
        https://github.com/g200kg/audioworklet-adsrnode?tab=readme-ov-file
        */

    AdsrNode.Initialize(this.app.actx).then((e) => {
      this.createNode();
    });
  }

  noteOn() {
    this.node.trigger.value = 1;
  }
  noteOff() {
    this.node.trigger.value = 0;
  }

  createNode() {
    this.node = new AdsrNode(this.app.actx, {
      attack: 0.5,
      attackcurve: 0.5,
      decay: 0.2,
      sustain: 0.1,
      release: 0.8,
    });
  }
}
