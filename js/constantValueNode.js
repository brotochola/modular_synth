class ConstantValueNode extends Component {
  static name = "Constant";
  constructor(app, serializedData) {
    super(app, serializedData);
    this.infoText =
      "Constant DC voltage. Outputs a steady level set by the offset knob. Use it to bias parameters, hold a fixed frequency, or feed mixers and math modules. Patch into offset to automate the value.";

    this.node = this.app.actx.createConstantSource();
    this.node.start();

    // this.createInputButtons();
  }
}
