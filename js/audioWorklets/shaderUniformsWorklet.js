class ShaderUniformsWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "x1", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x2", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x3", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
      { name: "x4", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "a-rate" },
    ];
  }

  constructor() {
    super();
    this.tick = 0;
  }

  process(inputs, outputs, parameters) {
    this.tick++;
    if (this.tick % 8 === 0) {
      const pick = (p) => p[p.length - 1];
      this.port.postMessage({
        x1: pick(parameters.x1),
        x2: pick(parameters.x2),
        x3: pick(parameters.x3),
        x4: pick(parameters.x4),
      });
    }
    return true;
  }
}

registerProcessor("shader-uniforms-worklet", ShaderUniformsWorklet);
