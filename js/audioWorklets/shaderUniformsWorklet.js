class ShaderUniformsWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "x1", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x2", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x3", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x4", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
    ];
  }

  constructor(options) {
    super();
    AppConfig.bindProcessorSab(this, options);
    if (globalThis.AudioProfile) AudioProfile.attach(this, "shader-uniforms");
  }

  process(inputs, outputs, parameters) {
    let sab = this.sab;
    if (sab) {
      sab.setSlot(0, parameters.x1[parameters.x1.length - 1]);
      sab.setSlot(1, parameters.x2[parameters.x2.length - 1]);
      sab.setSlot(2, parameters.x3[parameters.x3.length - 1]);
      sab.setSlot(3, parameters.x4[parameters.x4.length - 1]);
      AppConfig.sabWriteGraphPeaks(sab, inputs, parameters);
      sab.publish();
    }
    return true;
  }
}

registerProcessor("shader-uniforms-worklet", ShaderUniformsWorklet);
