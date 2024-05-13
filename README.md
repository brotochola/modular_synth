# modular_synth

this is a small experiment using the WebAudio API.
A Modular synthesizer on the web using Oscillators, filters, gainNodes, etc.
But I not only want to use the components that already come with the WebAudio API, there's for example the File Input component that reads an image and uses the array of pixel data to generate sound waves. There's also the Mouse component that reads the X and Y positions of the mouse and allows yo the user to control whatever parameters they want.


https://brotochola.github.io/modular_synth


-------------------------

TODO:


* add explanations
* add midi input
* distorsion: add input for amount
* do something with the wave shaper
* mouse: make 3 outputs: wheel, x and y
* do the opposite of a multiplexor
* do something better with the background
* reverb: add type (get a few from the reverb.js website)
* webcam same as imagePlayer but with webcam
* mic: choose from all inputs available





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