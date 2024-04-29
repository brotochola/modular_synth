# modular_synth

this is a small experiment using the WebAudio API.
A Modular synthesizer on the web using Oscillators, filters, gainNodes, etc.
But I not only want to use the components that already come with the WebAudio API, there's for example the File Input component that reads an image and uses the array of pixel data to generate sound waves. There's also the Mouse component that reads the X and Y positions of the mouse and allows yo the user to control whatever parameters they want.


https://brotochola.github.io/modular_synth


-------------------------

TODO:
* add multiplayer with firebase
    + EASY WAY: 
        - the person leading puts the whole instrument on each change
        - the other user fetch the whole thing, and check, like react, what gotta be updated, using the id of the components
    + EVENT BASED:
        - give each user an id and save it in the localStorage
        - keep track in firebase who is online
        - all users leave events with userID and timestamp
        - all the changes are picked up by the rest of the users (checking to not fall into loops)
        - pickup all events between the last pickup and now
        - apply changes
    + ANOTER WAY:
        - components: { id:{connections:[{},{}]}, id:{connections:[{},{}]}}
        - when a component is created it creates a new collection with its data
        - each component updates only its own representation in firestore, including serialized connections coming from it
        - The data structure in firestore shuold be like:
            + main collection
                * document of a patch
                    - collection of components
                        + doc of the component including its connections
                * document of another patch
      

* fix saving with selects, inputs, images, etc
* add explanations
* upload/download json for instruments
* add midi features
* for audio player, add param to control currentTime

* nicer ui:
https://g200kg.github.io/webaudio-controls/docs/howitworks.html

* add drum machine, maybe with individual components:

https://dev.opera.com/articles/drum-sounds-webaudio/





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