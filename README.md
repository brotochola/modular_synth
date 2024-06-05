# modular_synth

this is a small experiment using the WebAudio API.
A Modular synthesizer on the web using Oscillators, filters, gainNodes, etc.
But I not only want to use the components that already come with the WebAudio API, there's for example the File Input component that reads an image and uses the array of pixel data to generate sound waves. There's also the Mouse component that reads the X and Y positions of the mouse and allows yo the user to control whatever parameters they want.


https://brotochola.github.io/modular_synth


-------------------------

TODO:

* USAR FFT (AMPLITUD DE CADA FRECUENCIA PARA GENERAR IMAGENES, DE ESTA FORMA NO HAY Q EPSERAR 48000 SAMPLES PARA GENRAR 48000 PIXELES)

* LOAD VIDEOS, 2 INPUTS: TIME OFFSET, PLAYBACKSPEED
* RECORDER NODE:
    https://github.com/cwilso/AudioRecorder/blob/master/js/main.js#L152
    https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination?retiredLocale=de
* in and out node for each component to have more complex components
* pitch / tempo shifter:
https://github.com/olvb/phaze/tree/master
* requestanimationframe for example in the number display
* component: draw an automation on a canvas and have an input for frequency, or a trigger
* ARPEGGIATOR
* tapper module
* midi is owned by users
* add explanations
* do something with the wave shaper
* mouse: make 3 outputs: wheel, x and y
* do the opposite of a multiplexor
* reverb: add type (get a few from the reverb.js website)
* add UI elements:
    * led
    * button
    * fader
    * knob
    * rack cover (this components should go on top of the cables canvas)
* BPM DETECTOR: https://github.com/qiuxiang/aubiojs?tab=readme-ov-file
* overdrive & distortion:
https://chatgpt.com/c/1dcba5bc-1ede-492f-97cf-d9175695ffef


------------------

IDEA FOR JOYSTICK:
L1: turn on and off kick drum
R1: hihat
L2: clap
R2: some other percu

Left Analog: bass filter
right analog: more fm? more noise?

TRIANGLE: toggle long/short amp relase
SQUARE: toggle long/short amp release
CIRCLE: toggle long/short filter attack
X: toggle long/short filter release

UP: one shot woman talking
DOWN: feedback bass delay
RIGHT: turn on/off pad
LEFT: toggle tremolo for pad?