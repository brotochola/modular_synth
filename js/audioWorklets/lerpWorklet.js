class LerpProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastValue = 0;
    this.time = 0.5;
    this.port.onmessage = (e) => {
      this.time = Math.abs(e.data.time);
      if (this.time == 0 || isNaN(this.time)) {
        this.time = 0.5;
      } else if (this.time < 0.0001) {
        this.time = 0.0001;
      }
    };
  }

  process(inputs, outputs) {
    const input = ((inputs || [])[0] || [])[0] || [];
    const output = ((outputs || [])[0] || [])[0] || [];

    for (let i = 0; i < input.length; i++) {
      try {
        output[i] =
          this.lastValue + ((input[i] - this.lastValue) * 0.0001) / this.time;
      } catch (e) {
        output[i] = 0;
      }

      this.lastValue = output[i] || 0;
    }

    // console.log(`interpolationTime: ${parameters.interpolationTime}`);
    // for (let channel = 0; channel < input.length; ++channel) {
    //   const inputChannel = input[channel];
    //   const outputChannel = output[channel];

    //   for (let i = 0; i < inputChannel.length; ++i) {
    //     const currentValue = inputChannel[i];

    //     this.previousValue =
    //       this.previousValue + (currentValue - this.previousValue) * lerpFactor;
    //     outputChannel[i] = this.previousValue;
    //   }
    // }

    return true;
  }
}

registerProcessor("lerp-processor", LerpProcessor);
