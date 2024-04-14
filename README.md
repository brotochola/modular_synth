# modular_synth

this is a small experiment using the WebAudio API.
A Modular synthesizer on the web using Oscillators, filters, gainNodes, etc.
But I not only want to use the components that already come with the WebAudio API, there's for example the File Input component that reads an image and uses the array of pixel data to generate sound waves. There's also the Mouse component that reads the X and Y positions of the mouse and allows yo the user to control whatever parameters they want.


https://brotochola.github.io/modular_synth


-------------------------

TODO:
* add multiplayer with firebase
    EASY WAY: 
        1 - the person leading puts the whole instrument on each change
        2 - the other user fetch the whole thing, and check, like react, what gotta be updated, using the id of the components
    EVENT BASED:
        1 - give each user an id and save it in the localStorage
        2 - keep track in firebase who is online
        3 - all users leave events with userID and timestamp
        4 - all the changes are picked up by the rest of the users (checking to not fall into loops)
        5 - pickup all events between the last pickup and now
        6 - apply changes

* fix saving with selects, inputs, images, etc
* add explanations
* make ui better
* upload/download json for instruments
* add midi features
* add joystick features
* for audio player, add param to control currentTime
* customProcessor: if no input->0
* add envelope:
    https://github.com/itsjoesullivan/envelope-generator?tab=readme-ov-file