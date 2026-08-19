class MouseWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.port.onmessage = (e) => {
      this.x = e.data.x;
      this.y = e.data.y;
    };
  }

  process(inputs, outputs) {
    let chX = outputs[0] && outputs[0][0];
    let chY = outputs[1] && outputs[1][0];
    let x = this.x;
    let y = this.y;
    if (chX) {
      for (let i = 0; i < chX.length; i++) chX[i] = x;
    }
    if (chY) {
      for (let i = 0; i < chY.length; i++) chY[i] = y;
    }
    return true;
  }
}

registerProcessor("mouse-worklet", MouseWorklet);
