const firebaseConfig = {
  apiKey: "AIzaSyDw58gP1VYImF9or9dnE9WlPc3BWExGE7Y",
  authDomain: "modular-bbb10.firebaseapp.com",
  projectId: "modular-bbb10",
  storageBucket: "modular-bbb10.appspot.com",
  messagingSenderId: "286099414646",
  appId: "1:286099414646:web:09a95b5f0b3a26a5f90957",
  measurementId: "G-FD6DWLFPVV",
};

const collection = "modular";

firebase.initializeApp(firebaseConfig);

// Get a reference to the Firestore service
var firestore = firebase.firestore();
var collectionRef = firestore.collection(collection);

// async function createDocInFirestore(patchName, serializedOutputComponent) {
//   await collectionRef
//     .doc(patchName)
//     .collection("components")
//     .doc("output")
//     .set(serializedOutputComponent);
// }

// COLLECTION -> DOC -> COLLECTION OF COMPONENTS -> DOC WITH COMPONENT
async function createInstanceOfComponentInFirestore(
  patchName,
  serializedComponent
) {
  // console.log("# creating instance of components", patchName, serializedComponent, serializedComponent.id)
  collectionRef
    .doc(patchName)
    .collection("components")
    .doc(serializedComponent.id)
    .set(serializedComponent);
}

async function putBPMInFireStore(patchName, bpm) {
  collectionRef.doc(patchName).set({ bpm: bpm });
}

async function removeComponentFromFirestore(patchName, id) {
  collectionRef.doc(patchName).collection("components").doc(id).delete();
}

async function getListOfComponentsFromFirestore(patchName) {
  let docs = await collectionRef.doc(patchName).collection("components").get();

  return docs.docs.map((k) => k.id);
}

async function getDocFromFirebase(name) {
  let ret = { components: [], connections: [] };
  let docs = await collectionRef.doc(name).collection("components").get();
  let bpm = ((await collectionRef.doc(name).get()).data() || {}).bpm;
  ret.bpm = bpm;

  docs.forEach((doc) => {
    ret.components.push(doc.data());
  });

  //PUT CONNECTIONS IN ONE SINGLE ARRAY, THE SAME FORMAT AS I'M SAVING LOCALLY
  ret.components.map((k) =>
    (k.connections || []).map((c) => {
      ret.connections.push(c);
    })
  );

  if (ret.components.length == 0) return null;

  return ret;
}

async function saveInFireStore(obj, id) {
  var docRef = collectionRef.doc(id);
  let ret = await docRef.set(obj);
  return ret;
}

async function getAllDocuments() {
  // Reference to the collection
  let ret = {};
  // Get all documents in the collection
  let docs = await collectionRef.get();

  docs.forEach((doc) => {
    // doc.data() is the data of each document
    ret[doc.id] = doc.data();
    console.log(doc.id, " => ", doc.data());
  });

  return ret;
}

function listenToChangesInWholePatch(docName, cb) {
  // console.log("# listen to changes", docName, componentID)
  const docRef = firebase.firestore().collection("modular").doc(docName);

  docRef.onSnapshot((doc) => {
    const data = doc.data();
    if (cb instanceof Function) {
      cb(data);
    }
  });
}

function listenToChangesInComponent(docName, componentID, cb) {
  // console.log("# listen to changes", docName, componentID)
  const docRef = firebase
    .firestore()
    .collection("modular")
    .doc(docName)
    .collection("components")
    .doc(componentID);

  docRef.onSnapshot((doc) => {
    const data = doc.data();
    if (cb instanceof Function) {
      cb(data);
    }
  });
}

async function getComponentFromFirestore(docName, componentID, cb) {
  // console.log("# listen to changes", docName, componentID)
  let doc = await collectionRef
    .doc(docName)
    .collection("components")
    .doc(componentID)
    .get();

  if (cb instanceof Function) {
    cb(doc.data());
  }
}
