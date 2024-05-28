# modular_synth

this is a small experiment using the WebAudio API.
A Modular synthesizer on the web using Oscillators, filters, gainNodes, etc.
But I not only want to use the components that already come with the WebAudio API, there's for example the File Input component that reads an image and uses the array of pixel data to generate sound waves. There's also the Mouse component that reads the X and Y positions of the mouse and allows yo the user to control whatever parameters they want.


https://brotochola.github.io/modular_synth


-------------------------

TODO:

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
* PITCH DETECTOR:
    https://glitch.com/edit/#!/essentiajs-pitchmelodia?path=script.js%3A1%3A0
https://chatgpt.com/g/g-2DQzU5UZl-code-copilot/c/e7d926fe-c152-406f-a7f6-f9bb5e13f694
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